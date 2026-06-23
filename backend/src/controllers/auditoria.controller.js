const db = require('../db');

// Listagem de logs de auditoria (exclusivo para administrador)
exports.listLogs = async (req, res) => {
  const { usuario, acao, data_inicio, data_fim } = req.query;

  try {
    let query = `
      SELECT 
        a.id,
        a.acao,
        a.tabela_afetada,
        a.registro_id,
        a.detalhe,
        a.realizado_em,
        a.ip_origem,
        u.nome as usuario_nome,
        u.email as usuario_email,
        u.perfil as usuario_perfil
      FROM audit_log a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE 1=1
    `;
    
    const params = [];

    if (usuario) {
      params.push(`%${usuario.trim()}%`);
      query += ` AND (u.nome ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    if (acao) {
      params.push(`%${acao.trim()}%`);
      query += ` AND a.acao ILIKE $${params.length}`;
    }

    if (data_inicio) {
      params.push(data_inicio); // Formato esperado: YYYY-MM-DD
      query += ` AND a.realizado_em >= $${params.length}::TIMESTAMP`;
    }

    if (data_fim) {
      // Ajustar data_fim para o final do dia (23:59:59)
      params.push(`${data_fim} 23:59:59`);
      query += ` AND a.realizado_em <= $${params.length}::TIMESTAMP`;
    }

    query += ' ORDER BY a.realizado_em DESC LIMIT 200'; // Limitar às últimas 200 por segurança de performance

    const { rows } = await db.query(query, params);
    return res.json(rows);

  } catch (error) {
    console.error('Erro ao listar auditoria:', error);
    return res.status(500).json({ error: 'Erro ao carregar logs de auditoria.' });
  }
};
