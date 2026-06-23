const db = require('../db');
const { logAudit } = require('../utils/auditHelper');
const xlsx = require('xlsx');

// 1. Listagem de Materiais com Filtros e Paginação
exports.list = async (req, res) => {
  const { codigo, grupo, descricao, unidade, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  
  try {
    let queryParams = [];
    let countParams = [];
    let whereClauses = ['m.ativo = TRUE'];

    // Filtros de busca
    if (codigo) {
      queryParams.push(`%${codigo.trim()}%`);
      countParams.push(`%${codigo.trim()}%`);
      whereClauses.push(`m.codigo ILIKE $${queryParams.length}`);
    }
    if (grupo) {
      queryParams.push(`%${grupo.trim()}%`);
      countParams.push(`%${grupo.trim()}%`);
      whereClauses.push(`m.grupo ILIKE $${queryParams.length}`);
    }
    if (descricao) {
      queryParams.push(`%${descricao.trim()}%`);
      countParams.push(`%${descricao.trim()}%`);
      whereClauses.push(`m.descricao ILIKE $${queryParams.length}`);
    }
    if (unidade) {
      queryParams.push(unidade.trim());
      countParams.push(unidade.trim());
      whereClauses.push(`m.unidade = $${queryParams.length}`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Query para contagem total filtrada
    const countQuery = `
      SELECT COUNT(*) 
      FROM materiais m
      ${whereString}
    `;
    const countResult = await db.query(countQuery, countParams);
    const totalItems = parseInt(countResult.rows[0].count, 10);

    // Query com cálculo de estoque líquido disponível em tempo real
    // disponivel_liquido = quantidade_fisica - SUM(reservas ativas do material)
    queryParams.push(parseInt(limit, 10));
    const limitPlaceholder = `$${queryParams.length}`;
    queryParams.push(offset);
    const offsetPlaceholder = `$${queryParams.length}`;

    const selectQuery = `
      SELECT 
        m.id,
        m.codigo,
        m.grupo,
        m.descricao,
        m.unidade,
        m.quantidade_fisica::FLOAT as quantidade_fisica,
        m.peso_unitario::FLOAT as peso_unitario,
        COALESCE(r.total_reservado, 0)::FLOAT as total_reservado,
        (m.quantidade_fisica - COALESCE(r.total_reservado, 0))::FLOAT as disponivel_liquido,
        m.criado_em,
        m.atualizado_em
      FROM materiais m
      LEFT JOIN (
        SELECT material_id, SUM(quantidade_reservada) AS total_reservado
        FROM reservas
        WHERE status = 'ativa'
        GROUP BY material_id
      ) r ON m.id = r.material_id
      ${whereString}
      ORDER BY m.codigo ASC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const { rows } = await db.query(selectQuery, queryParams);

    return res.json({
      materials: rows,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: parseInt(page, 10),
        itemsPerPage: parseInt(limit, 10)
      }
    });

  } catch (error) {
    console.error('Erro ao listar materiais:', error);
    return res.status(500).json({ error: 'Erro ao buscar catálogo de materiais.' });
  }
};

// 2. Cadastro Manual de Material
exports.create = async (req, res) => {
  const { codigo, grupo, descricao, unidade, quantidade_fisica = 0, peso_unitario } = req.body;

  if (!codigo || !grupo || !descricao || !unidade) {
    return res.status(400).json({ error: 'Os campos Código, Grupo, Descrição e Unidade são obrigatórios.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar unicidade do código (apenas ativos)
    const checkRes = await client.query('SELECT id, ativo FROM materiais WHERE codigo = $1', [codigo.toUpperCase().trim()]);
    if (checkRes.rows.length > 0) {
      if (checkRes.rows[0].ativo) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `O código de material '${codigo}' já está cadastrado e ativo.` });
      } else {
        // Se estava desativado, reativa e atualiza os dados
        const existingId = checkRes.rows[0].id;
        const updateRes = await client.query(
          `UPDATE materiais 
           SET grupo = $1, descricao = $2, unidade = $3, quantidade_fisica = $4, peso_unitario = $5, ativo = TRUE, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = $6
           RETURNING *`,
          [grupo.trim(), descricao.trim(), unidade.toUpperCase().trim(), quantidade_fisica, peso_unitario, existingId]
        );

        if (quantidade_fisica > 0) {
          await client.query(
            `INSERT INTO movimentacoes (material_id, tipo, quantidade, motivo, realizado_por)
             VALUES ($1, 'entrada', $2, 'Cadastro e reativação de material com estoque inicial', $3)`,
            [existingId, quantidade_fisica, req.user.id]
          );
        }

        await logAudit(req, 'material_reativado', 'materiais', existingId, `Material ${codigo} reativado via cadastro manual.`);
        await client.query('COMMIT');
        return res.status(201).json(updateRes.rows[0]);
      }
    }

    // Inserir novo material
    const insertRes = await client.query(
      `INSERT INTO materiais (codigo, grupo, descricao, unidade, quantidade_fisica, peso_unitario)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [codigo.toUpperCase().trim(), grupo.trim(), descricao.trim(), unidade.toUpperCase().trim(), quantidade_fisica, peso_unitario]
    );
    const newMaterial = insertRes.rows[0];

    // Registrar movimentação de entrada inicial se quantidade > 0
    if (quantidade_fisica > 0) {
      await client.query(
        `INSERT INTO movimentacoes (material_id, tipo, quantidade, motivo, realizado_por)
         VALUES ($1, 'entrada', $2, 'Estoque físico inicial no cadastro do material', $3)`,
        [newMaterial.id, quantidade_fisica, req.user.id]
      );
    }

    await logAudit(req, 'material_criado', 'materiais', newMaterial.id, `Material ${newMaterial.codigo} cadastrado manualmente.`);
    await client.query('COMMIT');

    return res.status(201).json(newMaterial);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar material:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar material.' });
  } finally {
    client.release();
  }
};

// 3. Edição de quantidade física (Movimentação com motivo obrigatório)
exports.adjustQuantity = async (req, res) => {
  const { id } = req.params;
  const { tipo, quantidade, motivo } = req.body; // tipo: 'entrada', 'saida', 'ajuste'. quantidade: valor positivo.

  if (!tipo || quantidade === undefined || !motivo || motivo.trim() === '') {
    return res.status(400).json({ error: 'Tipo de movimentação, quantidade e motivo são obrigatórios.' });
  }

  if (!['entrada', 'saida', 'ajuste'].includes(tipo)) {
    return res.status(400).json({ error: "O tipo de movimentação deve ser 'entrada', 'saida' ou 'ajuste'." });
  }

  const qtdVal = parseFloat(quantidade);
  if (isNaN(qtdVal) || qtdVal < 0) {
    return res.status(400).json({ error: 'A quantidade deve ser um número positivo.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Buscar estoque atual e reservas ativas
    const selectRes = await client.query(
      `SELECT 
         m.quantidade_fisica::FLOAT as quantidade_fisica, 
         m.codigo,
         COALESCE(r.total_reservado, 0)::FLOAT as total_reservado
       FROM materiais m
       LEFT JOIN (
         SELECT material_id, SUM(quantidade_reservada) AS total_reservado
         FROM reservas
         WHERE status = 'ativa'
         GROUP BY material_id
       ) r ON m.id = r.material_id
       WHERE m.id = $1 AND m.ativo = TRUE`,
      [id]
    );

    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Material não encontrado ou inativo.' });
    }

    const { quantidade_fisica: qtdFisicaAtual, codigo, total_reservado: totalReservado } = selectRes.rows[0];
    let novaQtdFisica = qtdFisicaAtual;
    let qtdMovimentada = qtdVal;

    if (tipo === 'entrada') {
      novaQtdFisica = qtdFisicaAtual + qtdVal;
    } else if (tipo === 'saida') {
      if (qtdFisicaAtual < qtdVal) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Saldo físico insuficiente para saída. Estoque atual: ${qtdFisicaAtual}. Solicitado: ${qtdVal}.` 
        });
      }
      // Verificar se a saída física infringe as reservas ativas
      const novoDisponivel = (qtdFisicaAtual - qtdVal) - totalReservado;
      if (novoDisponivel < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Ação negada. A saída de ${qtdVal} deixaria o estoque físico abaixo do total reservado (${totalReservado}). Estoque líquido ficaria negativo.`
        });
      }
      novaQtdFisica = qtdFisicaAtual - qtdVal;
    } else if (tipo === 'ajuste') {
      // Ajuste define o estoque absoluto direto
      novaQtdFisica = qtdVal;
      qtdMovimentada = Math.abs(novaQtdFisica - qtdFisicaAtual);
      
      const novoDisponivel = novaQtdFisica - totalReservado;
      if (novoDisponivel < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Ação negada. Definir o estoque físico para ${qtdVal} infringe as reservas ativas (${totalReservado}). Estoque líquido ficaria negativo.`
        });
      }
    }

    // Atualizar estoque do material
    await client.query(
      'UPDATE materiais SET quantidade_fisica = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2',
      [novaQtdFisica, id]
    );

    // Gravar movimentação
    await client.query(
      `INSERT INTO movimentacoes (material_id, tipo, quantidade, motivo, realizado_por)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, tipo, qtdMovimentada, motivo.trim(), req.user.id]
    );

    // Gravar auditoria
    await logAudit(
      req, 
      'movimentacao_estoque', 
      'materiais', 
      id, 
      `Movimentação '${tipo}' de ${qtdMovimentada} unidades do material ${codigo}. Motivo: ${motivo.trim()}. Novo físico: ${novaQtdFisica}`
    );

    await client.query('COMMIT');
    return res.json({ 
      message: 'Estoque atualizado com sucesso.', 
      quantidade_fisica: novaQtdFisica 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao ajustar quantidade:', error);
    return res.status(500).json({ error: 'Erro ao registrar movimentação de estoque.' });
  } finally {
    client.release();
  }
};

// 4. Histórico de movimentações de um material
exports.getMovements = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT 
         mv.id,
         mv.tipo,
         mv.quantidade::FLOAT as quantidade,
         mv.motivo,
         mv.realizado_em,
         u.nome as realizado_por,
         p.codigo_projeto as projeto_codigo
       FROM movimentacoes mv
       JOIN usuarios u ON mv.realizado_por = u.id
       LEFT JOIN projetos p ON mv.projeto_id = p.id
       WHERE mv.material_id = $1
       ORDER BY mv.realizado_em DESC`,
      [id]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error);
    return res.status(500).json({ error: 'Erro ao obter histórico do material.' });
  }
};

// 5. Importação de catálogo de materiais via Planilha (.xlsx ou .csv)
exports.importCatalog = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    // Ler buffer do arquivo
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'O arquivo enviado está vazio.' });
    }

    const errors = [];
    const materialsToProcess = [];
    const seenCodesInSheet = new Set();

    // Mapeamento e validação linha a linha (1-indexed baseada nas linhas da tabela de dados)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Linha 1 é o cabeçalho no Excel geralmente

      // Mapeamento case-insensitive para as colunas requeridas
      const codigoRaw = row['Código'] || row['codigo'] || row['CODIGO'] || row['Codigo'];
      const grupoRaw = row['Grupo'] || row['grupo'] || row['GRUPO'];
      const descricaoRaw = row['Descrição Técnica'] || row['descricao_tecnica'] || row['DESCRICAO'] || row['Descrição'] || row['descricao'];
      const unidadeRaw = row['Unidade'] || row['unidade'] || row['UNIDADE'];
      const quantidadeRaw = row['Quantidade'] || row['quantidade'] || row['QUANTIDADE'] || row['Estoque'] || row['estoque'] || 0;
      const pesoRaw = row['Peso Unitário'] || row['peso_unitario'] || row['PESO_UNITARIO'] || row['Peso'] || row['peso'];

      const codigo = codigoRaw ? String(codigoRaw).trim().toUpperCase() : null;
      const grupo = grupoRaw ? String(grupoRaw).trim() : null;
      const descricao = descricaoRaw ? String(descricaoRaw).trim() : null;
      const unidade = unidadeRaw ? String(unidadeRaw).trim().toUpperCase() : null;
      const quantidade = parseFloat(quantidadeRaw);
      const peso = pesoRaw !== undefined && pesoRaw !== null && String(pesoRaw).trim() !== '' ? parseFloat(pesoRaw) : null;

      // Validações
      if (!codigo) {
        errors.push(`Linha ${rowNumber}: O campo 'Código' é obrigatório.`);
        continue;
      }
      if (seenCodesInSheet.has(codigo)) {
        errors.push(`Linha ${rowNumber}: Código '${codigo}' duplicado na planilha.`);
        continue;
      }
      seenCodesInSheet.add(codigo);

      if (!grupo) {
        errors.push(`Linha ${rowNumber}: O campo 'Grupo' é obrigatório.`);
      }
      if (!descricao) {
        errors.push(`Linha ${rowNumber}: O campo 'Descrição Técnica' é obrigatório.`);
      }
      if (!unidade) {
        errors.push(`Linha ${rowNumber}: O campo 'Unidade' é obrigatório.`);
      } else if (unidade.length > 10) {
        errors.push(`Linha ${rowNumber}: A unidade não deve exceder 10 caracteres.`);
      }
      if (isNaN(quantidade) || quantidade < 0) {
        errors.push(`Linha ${rowNumber}: Quantidade física '${quantidadeRaw}' deve ser um número maior ou igual a 0.`);
      }
      if (peso !== null && (isNaN(peso) || peso < 0)) {
        errors.push(`Linha ${rowNumber}: Peso unitário '${pesoRaw}' deve ser um número maior ou igual a 0.`);
      }

      materialsToProcess.push({
        codigo,
        grupo,
        descricao,
        unidade,
        quantidade,
        peso,
        rowNumber
      });
    }

    // Se houver qualquer erro de validação nas linhas, abortamos antes de tocar no banco
    if (errors.length > 0) {
      return res.status(422).json({ 
        error: 'Inconsistências encontradas na planilha de materiais. Importação não realizada.', 
        details: errors 
      });
    }

    // Executar inserções/atualizações de forma transacional
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      let criados = 0;
      let atualizados = 0;

      for (const mat of materialsToProcess) {
        // Verificar se já existe no banco
        const { rows } = await client.query('SELECT id, quantidade_fisica::FLOAT as quantidade_fisica, ativo FROM materiais WHERE codigo = $1', [mat.codigo]);

        if (rows.length > 0) {
          const existing = rows[0];
          
          if (!existing.ativo) {
            // Reativar
            await client.query(
              `UPDATE materiais 
               SET grupo = $1, descricao = $2, unidade = $3, quantidade_fisica = $4, peso_unitario = $5, ativo = TRUE, atualizado_em = CURRENT_TIMESTAMP
               WHERE id = $6`,
              [mat.grupo, mat.descricao, mat.unidade, mat.quantidade, mat.peso, existing.id]
            );
            
            // Gravar movimentação de entrada do novo saldo físico
            if (mat.quantidade > 0) {
              await client.query(
                `INSERT INTO movimentacoes (material_id, tipo, quantidade, motivo, realizado_por)
                 VALUES ($1, 'entrada', $2, 'Reativação de material via importação de planilha', $3)`,
                [existing.id, mat.quantidade, req.user.id]
              );
            }
            atualizados++;
          } else {
            // Atualizar cadastro e estoque físico
            const diffQtd = mat.quantidade - existing.quantidade_fisica;
            
            await client.query(
              `UPDATE materiais 
               SET grupo = $1, descricao = $2, unidade = $3, quantidade_fisica = $4, peso_unitario = $5, atualizado_em = CURRENT_TIMESTAMP
               WHERE id = $6`,
              [mat.grupo, mat.descricao, mat.unidade, mat.quantidade, mat.peso, existing.id]
            );

            // Se a quantidade física mudou, gera uma movimentação de ajuste
            if (diffQtd !== 0) {
              const tipoMov = diffQtd > 0 ? 'entrada' : 'saida';
              
              // Se for saída, verificar se deixa estoque líquido negativo
              if (diffQtd < 0) {
                const resCheck = await client.query(
                  `SELECT COALESCE(SUM(quantidade_reservada), 0)::FLOAT as reservado FROM reservas WHERE material_id = $1 AND status = 'ativa'`,
                  [existing.id]
                );
                const reservado = resCheck.rows[0].reservado;
                if (mat.quantidade < reservado) {
                  throw new Error(`Linha ${mat.rowNumber}: Não é possível reduzir o estoque do código '${mat.codigo}' para ${mat.quantidade} pois há ${reservado} unidades reservadas ativamente.`);
                }
              }

              await client.query(
                `INSERT INTO movimentacoes (material_id, tipo, quantidade, motivo, realizado_por)
                 VALUES ($1, $2, $3, 'Ajuste de estoque via importação de planilha', $4)`,
                [existing.id, tipoMov, Math.abs(diffQtd), req.user.id]
              );
            }
            atualizados++;
          }
        } else {
          // Criar novo
          const insertRes = await client.query(
            `INSERT INTO materiais (codigo, grupo, descricao, unidade, quantidade_fisica, peso_unitario)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [mat.codigo, mat.grupo, mat.descricao, mat.unidade, mat.quantidade, mat.peso]
          );

          if (mat.quantidade > 0) {
            await client.query(
              `INSERT INTO movimentacoes (material_id, tipo, quantidade, motivo, realizado_por)
               VALUES ($1, 'entrada', $2, 'Carga inicial via importação de planilha', $3)`,
              [insertRes.rows[0].id, mat.quantidade, req.user.id]
            );
          }
          criados++;
        }
      }

      await logAudit(req, 'material_importado', 'materiais', null, `Importação de planilha concluída. Criados: ${criados}, Atualizados: ${atualizados}`);
      await client.query('COMMIT');
      return res.json({ message: `Importação realizada com sucesso. ${criados} materiais novos cadastrados, ${atualizados} atualizados.` });

    } catch (transactionError) {
      await client.query('ROLLBACK');
      console.error('Erro transacional na importação:', transactionError);
      return res.status(400).json({ error: transactionError.message || 'Erro durante a gravação dos dados no banco.' });
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Erro ao ler planilha:', error);
    return res.status(500).json({ error: 'Falha ao processar o arquivo enviado. Certifique-se de que é um formato válido.' });
  }
};
