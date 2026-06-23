const db = require('../db');
const { logAudit } = require('../utils/auditHelper');

// 1. Listar todas as reservas ativas (com filtros opcionais)
exports.listActive = async (req, res) => {
  const { projeto_id, material_id } = req.query;
  try {
    let query = `
      SELECT 
        r.id,
        r.projeto_id,
        r.material_id,
        r.quantidade_reservada::FLOAT as quantidade_reservada,
        r.status,
        r.reservado_em,
        p.codigo_projeto as projeto_codigo,
        p.nome as projeto_nome,
        m.codigo as material_codigo,
        m.descricao as material_descricao,
        m.unidade as material_unidade,
        u.nome as reservado_por_nome
      FROM reservas r
      JOIN projetos p ON r.projeto_id = p.id
      JOIN materiais m ON r.material_id = m.id
      JOIN usuarios u ON r.reservado_por = u.id
      WHERE r.status = 'ativa' AND p.ativo = TRUE AND m.ativo = TRUE
    `;
    
    const params = [];
    if (projeto_id) {
      params.push(projeto_id);
      query += ` AND r.projeto_id = $${params.length}`;
    }
    if (material_id) {
      params.push(material_id);
      query += ` AND r.material_id = $${params.length}`;
    }
    
    query += ' ORDER BY r.reservado_em DESC';
    
    const { rows } = await db.query(query, params);
    return res.json(rows);
  } catch (error) {
    console.error('Erro ao listar reservas:', error);
    return res.status(500).json({ error: 'Erro ao carregar reservas.' });
  }
};

// 2. Criar uma reserva manual com verificação de estoque líquido
exports.create = async (req, res) => {
  const { projeto_id, material_id, quantidade_reservada } = req.body;

  if (!projeto_id || !material_id || !quantidade_reservada) {
    return res.status(400).json({ error: 'Projeto, Material e Quantidade são campos obrigatórios.' });
  }

  const qtdVal = parseFloat(quantidade_reservada);
  if (isNaN(qtdVal) || qtdVal <= 0) {
    return res.status(400).json({ error: 'A quantidade reservada deve ser um número maior que zero.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar se o projeto está ativo e permite reservas
    const projRes = await client.query('SELECT status, codigo_projeto FROM projetos WHERE id = $1 AND ativo = TRUE', [projeto_id]);
    if (projRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Projeto não encontrado ou inativo.' });
    }
    const { status: projStatus, codigo_projeto: projCodigo } = projRes.rows[0];
    
    if (['encerrado', 'planejamento'].includes(projStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Não é possível gerar reservas para projetos com status '${projStatus}'.` 
      });
    }

    // Calcular disponível líquido em tempo real para o material
    const matRes = await client.query(
      `SELECT 
         m.codigo, 
         m.quantidade_fisica::FLOAT as quantidade_fisica,
         COALESCE(r.total_reservado, 0)::FLOAT as total_reservado
       FROM materiais m
       LEFT JOIN (
         SELECT material_id, SUM(quantidade_reservada) AS total_reservado
         FROM reservas
         WHERE status = 'ativa'
         GROUP BY material_id
       ) r ON m.id = r.material_id
       WHERE m.id = $1 AND m.ativo = TRUE`,
      [material_id]
    );

    if (matRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Material não encontrado ou inativo.' });
    }

    const { codigo: matCodigo, quantidade_fisica: qtdFisica, total_reservado: totalReservado } = matRes.rows[0];
    const disponivelLiquido = qtdFisica - totalReservado;

    // Regra de negócio: disponivel_liquido >= quantidade_a_reservar
    if (disponivelLiquido < qtdVal) {
      const falta = qtdVal - disponivelLiquido;
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: 'Reserva bloqueada: Saldo líquido disponível insuficiente no almoxarifado.',
        disponivel_liquido: disponivelLiquido,
        quantidade_em_falta: falta
      });
    }

    // Inserir reserva
    const insertRes = await client.query(
      `INSERT INTO reservas (projeto_id, material_id, quantidade_reservada, status, reservado_por)
       VALUES ($1, $2, $3, 'ativa', $4)
       RETURNING *`,
      [projeto_id, material_id, qtdVal, req.user.id]
    );
    const newReserve = insertRes.rows[0];

    await logAudit(req, 'reserva_criada', 'reservas', newReserve.id, `Criada reserva de ${qtdVal} unidades do material ${matCodigo} para o projeto ${projCodigo}.`);
    await client.query('COMMIT');

    return res.status(201).json(newReserve);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar reserva:', error);
    return res.status(500).json({ error: 'Erro ao gerar reserva.' });
  } finally {
    client.release();
  }
};

// 3. Cancelamento de reserva com motivo obrigatório
exports.cancel = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  if (!motivo || motivo.trim() === '') {
    return res.status(400).json({ error: 'O motivo do cancelamento é obrigatório.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Buscar reserva ativa
    const selectRes = await client.query(
      `SELECT r.id, r.status, r.quantidade_reservada, p.codigo_projeto, m.codigo as material_codigo
       FROM reservas r
       JOIN projetos p ON r.projeto_id = p.id
       JOIN materiais m ON r.material_id = m.id
       WHERE r.id = $1`,
      [id]
    );

    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    const reserva = selectRes.rows[0];
    if (reserva.status !== 'ativa') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Esta reserva não está mais ativa (status atual: '${reserva.status}').` });
    }

    // Cancelar
    await client.query(
      `UPDATE reservas 
       SET status = 'cancelada', motivo_cancelamento = $1, liberado_em = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [motivo.trim(), id]
    );

    await logAudit(
      req, 
      'reserva_cancelada', 
      'reservas', 
      id, 
      `Reserva do material ${reserva.material_codigo} para o projeto ${reserva.codigo_projeto} cancelada. Motivo: ${motivo.trim()}`
    );

    await client.query('COMMIT');
    return res.json({ message: 'Reserva cancelada com sucesso.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao cancelar reserva:', error);
    return res.status(500).json({ error: 'Erro ao cancelar reserva.' });
  } finally {
    client.release();
  }
};

// 4. Histórico completo de reservas (ativas, canceladas, liberadas)
exports.getHistory = async (req, res) => {
  const { projeto_id, material_id } = req.query;

  try {
    let query = `
      SELECT 
        r.id,
        r.quantidade_reservada::FLOAT as quantidade_reservada,
        r.status,
        r.reservado_em,
        r.liberado_em,
        r.motivo_cancelamento,
        p.codigo_projeto as projeto_codigo,
        p.nome as projeto_nome,
        m.codigo as material_codigo,
        m.descricao as material_descricao,
        m.unidade as material_unidade,
        u.nome as reservado_por_nome
      FROM reservas r
      JOIN projetos p ON r.projeto_id = p.id
      JOIN materiais m ON r.material_id = m.id
      JOIN usuarios u ON r.reservado_por = u.id
      WHERE p.ativo = TRUE AND m.ativo = TRUE
    `;

    const params = [];
    if (projeto_id) {
      params.push(projeto_id);
      query += ` AND r.projeto_id = $${params.length}`;
    }
    if (material_id) {
      params.push(material_id);
      query += ` AND r.material_id = $${params.length}`;
    }

    query += ' ORDER BY r.reservado_em DESC';

    const { rows } = await db.query(query, params);
    return res.json(rows);

  } catch (error) {
    console.error('Erro ao buscar histórico de reservas:', error);
    return res.status(500).json({ error: 'Erro ao carregar histórico de reservas.' });
  }
};
