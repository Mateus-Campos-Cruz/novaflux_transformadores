const db = require('../db');
const { logAudit } = require('../utils/auditHelper');
const xlsx = require('xlsx');

// 1. Listar Projetos com Status e Indicador de Ruptura
exports.list = async (req, res) => {
  try {
    // Retorna projetos com um booleano 'tem_ruptura' em tempo real
    // Um projeto está em ruptura se houver qualquer item em sua lista técnica 
    // onde a quantidade reservada + o disponível líquido total do material é inferior à quantidade necessária
    const query = `
      SELECT 
        p.id,
        p.codigo_projeto,
        p.nome,
        p.descricao,
        p.status,
        p.criado_por,
        p.criado_em,
        p.atualizado_em,
        u.nome as criado_por_nome,
        EXISTS (
          SELECT 1 
          FROM lista_materiais lm
          JOIN materiais m ON lm.material_id = m.id
          LEFT JOIN (
            SELECT material_id, SUM(quantidade_reservada) AS total_reservado
            FROM reservas
            WHERE status = 'ativa'
            GROUP BY material_id
          ) r ON m.id = r.material_id
          LEFT JOIN (
            SELECT material_id, projeto_id, SUM(quantidade_reservada) AS reservado_projeto
            FROM reservas
            WHERE status = 'ativa' AND projeto_id = p.id
            GROUP BY material_id, projeto_id
          ) rp ON m.id = rp.material_id
          WHERE lm.projeto_id = p.id
            AND lm.quantidade_necessaria > COALESCE(rp.reservado_projeto, 0)
            AND (m.quantidade_fisica - COALESCE(r.total_reservado, 0)) < (lm.quantidade_necessaria - COALESCE(rp.reservado_projeto, 0))
        ) AS tem_ruptura
      FROM projetos p
      LEFT JOIN usuarios u ON p.criado_por = u.id
      WHERE p.ativo = TRUE
      ORDER BY p.criado_em DESC
    `;

    const { rows } = await db.query(query);
    return res.json(rows);

  } catch (error) {
    console.error('Erro ao listar projetos:', error);
    return res.status(500).json({ error: 'Erro ao buscar projetos.' });
  }
};

// 2. Cadastro de Novo Projeto
exports.create = async (req, res) => {
  const { codigo_projeto, nome, descricao, status = 'planejamento' } = req.body;

  if (!codigo_projeto || !nome) {
    return res.status(400).json({ error: 'Os campos Código do Projeto e Nome são obrigatórios.' });
  }

  if (!['planejamento', 'reserva_ativa', 'em_producao', 'encerrado'].includes(status)) {
    return res.status(400).json({ error: 'Status do projeto inválido.' });
  }

  try {
    // Verificar unicidade do código
    const checkRes = await db.query('SELECT id FROM projetos WHERE codigo_projeto = $1', [codigo_projeto.toUpperCase().trim()]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: `O código de projeto '${codigo_projeto}' já está cadastrado.` });
    }

    const insertRes = await db.query(
      `INSERT INTO projetos (codigo_projeto, nome, descricao, status, criado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [codigo_projeto.toUpperCase().trim(), nome.trim(), descricao ? descricao.trim() : null, status, req.user.id]
    );
    const newProject = insertRes.rows[0];

    await logAudit(req, 'projeto_criado', 'projetos', newProject.id, `Projeto ${newProject.codigo_projeto} criado com sucesso.`);

    return res.status(201).json(newProject);

  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar projeto.' });
  }
};

// 3. Visualizar Detalhes do Projeto e Lista Técnica
exports.getById = async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar projeto
    const projRes = await db.query(
      `SELECT p.*, u.nome as criado_por_nome 
       FROM projetos p 
       LEFT JOIN usuarios u ON p.criado_por = u.id 
       WHERE p.id = $1 AND p.ativo = TRUE`,
      [id]
    );

    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado ou inativo.' });
    }

    const projeto = projRes.rows[0];

    // Buscar lista técnica de materiais com dados de estoque em tempo real
    const itemsQuery = `
      SELECT 
        lm.id as lista_item_id,
        m.id as material_id,
        m.codigo,
        m.grupo,
        m.descricao,
        m.unidade,
        lm.quantidade_necessaria::FLOAT as quantidade_necessaria,
        COALESCE(rp.total_reservado_projeto, 0)::FLOAT as quantidade_reservada,
        (m.quantidade_fisica - COALESCE(rg.total_reservado_global, 0))::FLOAT as disponivel_liquido
      FROM lista_materiais lm
      JOIN materiais m ON lm.material_id = m.id
      -- Reservas deste projeto especificamente
      LEFT JOIN (
        SELECT material_id, SUM(quantidade_reservada) as total_reservado_projeto
        FROM reservas
        WHERE status = 'ativa' AND projeto_id = $1
        GROUP BY material_id
      ) rp ON m.id = rp.material_id
      -- Reservas globais de todos os projetos ativas
      LEFT JOIN (
        SELECT material_id, SUM(quantidade_reservada) as total_reservado_global
        FROM reservas
        WHERE status = 'ativa'
        GROUP BY material_id
      ) rg ON m.id = rg.material_id
      WHERE lm.projeto_id = $1 AND m.ativo = TRUE
      ORDER BY m.codigo ASC
    `;

    const itemsRes = await db.query(itemsQuery, [id]);
    
    // Processar status de cada item
    const items = itemsRes.rows.map(item => {
      const necessita = item.quantidade_necessaria;
      const reservado = item.quantidade_reservada;
      const dispLiq = item.disponivel_liquido;
      const pendente = Math.max(0, necessita - reservado);

      let status = 'disponivel'; // 'disponivel' (totalmente reservado ou disponível para reserva)
      if (reservado >= necessita) {
        status = 'disponivel';
      } else if (dispLiq >= pendente) {
        status = 'alerta'; // Não reservado completamente, mas tem estoque suficiente no almoxarifado
      } else {
        status = 'ruptura'; // Não reservado completamente e estoque disponível insuficiente
      }

      return {
        ...item,
        status,
        quantidade_pendente: pendente
      };
    });

    return res.json({
      projeto,
      materials: items
    });

  } catch (error) {
    console.error('Erro ao buscar projeto:', error);
    return res.status(500).json({ error: 'Erro ao carregar detalhes do projeto.' });
  }
};

// 4. Importar Lista Técnica de Materiais (Upload)
exports.importTechnicalList = async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    // Ler buffer
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'O arquivo enviado está vazio.' });
    }

    const errors = [];
    const itemsToProcess = [];
    const seenCodes = new Set();

    // Validar linhas
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      const codigoRaw = row['Código'] || row['codigo'] || row['CODIGO'] || row['Codigo'];
      const quantidadeRaw = row['Quantidade'] || row['quantidade'] || row['QUANTIDADE'] || row['Qtd'] || row['qtd'];

      const codigo = codigoRaw ? String(codigoRaw).trim().toUpperCase() : null;
      const quantidade = parseFloat(quantidadeRaw);

      if (!codigo) {
        errors.push(`Linha ${rowNumber}: Código do material é obrigatório.`);
        continue;
      }
      if (seenCodes.has(codigo)) {
        errors.push(`Linha ${rowNumber}: Código '${codigo}' duplicado na lista técnica.`);
        continue;
      }
      seenCodes.add(codigo);

      if (isNaN(quantidade) || quantidade <= 0) {
        errors.push(`Linha ${rowNumber}: Quantidade necessária '${quantidadeRaw}' deve ser maior que zero.`);
      }

      itemsToProcess.push({ codigo, quantidade, rowNumber });
    }

    if (errors.length > 0) {
      return res.status(422).json({
        error: 'Inconsistências encontradas na planilha de lista técnica.',
        details: errors
      });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar se o projeto existe e está ativo
      const projRes = await client.query('SELECT id, status FROM projetos WHERE id = $1 AND ativo = TRUE', [id]);
      if (projRes.rows.length === 0) {
        throw new Error('Projeto não encontrado ou inativo.');
      }
      if (projRes.rows[0].status === 'encerrado') {
        throw new Error('Não é possível modificar a lista técnica de um projeto encerrado.');
      }

      // Validar a existência dos materiais no banco
      for (const item of itemsToProcess) {
        const matRes = await client.query('SELECT id FROM materiais WHERE codigo = $1 AND ativo = TRUE', [item.codigo]);
        if (matRes.rows.length === 0) {
          throw new Error(`Linha ${item.rowNumber}: Material com código '${item.codigo}' não existe ou está desativado.`);
        }
        item.material_id = matRes.rows[0].id;
      }

      // Limpar a lista técnica atual do projeto (sobrescrever)
      await client.query('DELETE FROM lista_materiais WHERE projeto_id = $1', [id]);

      // Inserir novos itens
      for (const item of itemsToProcess) {
        await client.query(
          `INSERT INTO lista_materiais (projeto_id, material_id, quantidade_necessaria)
           VALUES ($1, $2, $3)`,
          [id, item.material_id, item.quantidade]
        );
      }

      await logAudit(req, 'lista_tecnica_importada', 'lista_materiais', id, `Importada lista técnica de ${itemsToProcess.length} itens.`);
      await client.query('COMMIT');

      return res.json({ message: `Lista técnica importada com sucesso. ${itemsToProcess.length} itens cadastrados.` });

    } catch (transactionError) {
      await client.query('ROLLBACK');
      console.error('Erro transacional na lista técnica:', transactionError);
      return res.status(400).json({ error: transactionError.message || 'Erro ao processar banco de dados.' });
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Erro ao ler planilha de lista técnica:', error);
    return res.status(500).json({ error: 'Erro ao processar arquivo enviado.' });
  }
};

// 5. Reservar em lote todos os materiais disponíveis para o projeto
exports.reserveBatch = async (req, res) => {
  const { id } = req.params;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar se o projeto existe e está ativo
    const projRes = await client.query('SELECT id, codigo_projeto, status FROM projetos WHERE id = $1 AND ativo = TRUE', [id]);
    if (projRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Projeto não encontrado ou inativo.' });
    }
    const projeto = projRes.rows[0];

    if (['encerrado', 'planejamento'].includes(projeto.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Não é possível efetuar reservas em lote para projetos com status '${projeto.status}'. Altere para 'reserva_ativa' primeiro.` 
      });
    }

    // Buscar lista técnica, total já reservado para este projeto, e estoque líquido disponível por material
    const itemsQuery = `
      SELECT 
        lm.material_id,
        m.codigo,
        lm.quantidade_necessaria::FLOAT as quantidade_necessaria,
        COALESCE(rp.total_reservado_projeto, 0)::FLOAT as quantidade_reservada,
        (m.quantidade_fisica - COALESCE(rg.total_reservado_global, 0))::FLOAT as disponivel_liquido
      FROM lista_materiais lm
      JOIN materiais m ON lm.material_id = m.id
      LEFT JOIN (
        SELECT material_id, SUM(quantidade_reservada) as total_reservado_projeto
        FROM reservas
        WHERE status = 'ativa' AND projeto_id = $1
        GROUP BY material_id
      ) rp ON m.id = rp.material_id
      LEFT JOIN (
        SELECT material_id, SUM(quantidade_reservada) as total_reservado_global
        FROM reservas
        WHERE status = 'ativa'
        GROUP BY material_id
      ) rg ON m.id = rg.material_id
      WHERE lm.projeto_id = $1 AND m.ativo = TRUE
    `;

    const itemsRes = await client.query(itemsQuery, [id]);
    let reservasCriadas = 0;

    for (const item of itemsRes.rows) {
      const necessita = item.quantidade_necessaria;
      const reservado = item.quantidade_reservada;
      const dispLiq = item.disponivel_liquido;

      const pendente = necessita - reservado;

      if (pendente > 0 && dispLiq > 0) {
        // Reservar o menor valor entre o que falta e o que tem no estoque líquido
        const qtdReservar = Math.min(pendente, dispLiq);

        await client.query(
          `INSERT INTO reservas (projeto_id, material_id, quantidade_reservada, status, reservado_por)
           VALUES ($1, $2, $3, 'ativa', $4)`,
          [id, item.material_id, qtdReservar, req.user.id]
        );
        reservasCriadas++;
      }
    }

    if (reservasCriadas > 0) {
      // Mudar status do projeto se necessário (ex: de reserva_ativa para em_producao, ou apenas manter)
      await logAudit(req, 'reservas_criadas_lote', 'reservas', id, `Criadas ${reservasCriadas} reservas em lote para o projeto ${projeto.codigo_projeto}.`);
      await client.query('COMMIT');
      return res.json({ message: `Sucesso! Foram geradas reservas para ${reservasCriadas} itens do projeto.` });
    } else {
      await client.query('ROLLBACK');
      return res.json({ message: 'Nenhuma nova reserva pôde ser gerada. Os itens já estão reservados ou não há estoque disponível livre.' });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na reserva em lote:', error);
    return res.status(500).json({ error: 'Erro ao gerar reservas em lote.' });
  } finally {
    client.release();
  }
};

// 6. Relatório de Pendências: itens em ruptura para este projeto específico
exports.getPendencies = async (req, res) => {
  const { id } = req.params;

  try {
    const projRes = await db.query('SELECT codigo_projeto, nome FROM projetos WHERE id = $1 AND ativo = TRUE', [id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado ou inativo.' });
    }
    const projeto = projRes.rows[0];

    // Buscar itens da lista técnica com pendência e ruptura
    const query = `
      SELECT 
        m.codigo,
        m.grupo,
        m.descricao,
        m.unidade,
        lm.quantidade_necessaria::FLOAT as quantidade_necessaria,
        COALESCE(rp.total_reservado_projeto, 0)::FLOAT as quantidade_reservada,
        (m.quantidade_fisica - COALESCE(rg.total_reservado_global, 0))::FLOAT as disponivel_liquido
      FROM lista_materiais lm
      JOIN materiais m ON lm.material_id = m.id
      LEFT JOIN (
        SELECT material_id, SUM(quantidade_reservada) as total_reservado_projeto
        FROM reservas
        WHERE status = 'ativa' AND projeto_id = $1
        GROUP BY material_id
      ) rp ON m.id = rp.material_id
      LEFT JOIN (
        SELECT material_id, SUM(quantidade_reservada) as total_reservado_global
        FROM reservas
        WHERE status = 'ativa'
        GROUP BY material_id
      ) rg ON m.id = rg.material_id
      WHERE lm.projeto_id = $1 AND m.ativo = TRUE
    `;

    const { rows } = await db.query(query, [id]);

    const pendencias = [];

    for (const item of rows) {
      const necessita = item.quantidade_necessaria;
      const reservado = item.quantidade_reservada;
      const dispLiq = item.disponivel_liquido;
      const pendente = necessita - reservado;

      // Há ruptura se o pendente > 0 E dispLiq < pendente
      if (pendente > 0 && dispLiq < pendente) {
        const falta = pendente - Math.max(0, dispLiq);
        pendencias.push({
          codigo: item.codigo,
          grupo: item.grupo,
          descricao: item.descricao,
          unidade: item.unidade,
          quantidade_necessaria: necessita,
          quantidade_reservada: reservado,
          quantidade_pendente: pendente,
          disponivel_liquido: dispLiq,
          quantidade_falta: falta // A quantidade real a comprar/abastecer
        });
      }
    }

    return res.json({
      projeto,
      pendencias
    });

  } catch (error) {
    console.error('Erro ao carregar pendências do projeto:', error);
    return res.status(500).json({ error: 'Erro ao buscar pendências.' });
  }
};

// 7. Atualizar Dados e Status do Projeto
exports.update = async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, status } = req.body;

  if (!nome || !status) {
    return res.status(400).json({ error: 'Nome e Status do projeto são obrigatórios.' });
  }

  if (!['planejamento', 'reserva_ativa', 'em_producao', 'encerrado'].includes(status)) {
    return res.status(400).json({ error: 'Status do projeto inválido.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Buscar projeto
    const projRes = await client.query('SELECT status, codigo_projeto FROM projetos WHERE id = $1 AND ativo = TRUE', [id]);
    if (projRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Projeto não encontrado ou inativo.' });
    }
    const currentStatus = projRes.rows[0].status;

    // Atualizar
    await client.query(
      `UPDATE projetos 
       SET nome = $1, descricao = $2, status = $3, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [nome.trim(), descricao ? descricao.trim() : null, status, id]
    );

    // Se o projeto for encerrado, liberamos todas as reservas do projeto de forma automática
    if (status === 'encerrado' && currentStatus !== 'encerrado') {
      // Liberar reservas
      await client.query(
        `UPDATE reservas 
         SET status = 'liberada', liberado_em = CURRENT_TIMESTAMP
         WHERE projeto_id = $1 AND status = 'ativa'`,
        [id]
      );
      
      await logAudit(req, 'projeto_encerrado_reservas_liberadas', 'projetos', id, `Projeto ${projRes.rows[0].codigo_projeto} encerrado. Reservas ativas liberadas.`);
    } else {
      await logAudit(req, 'projeto_atualizado', 'projetos', id, `Dados do projeto ${projRes.rows[0].codigo_projeto} atualizados.`);
    }

    await client.query('COMMIT');
    return res.json({ message: 'Projeto atualizado com sucesso.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar projeto:', error);
    return res.status(500).json({ error: 'Erro ao atualizar dados do projeto.' });
  } finally {
    client.release();
  }
};
