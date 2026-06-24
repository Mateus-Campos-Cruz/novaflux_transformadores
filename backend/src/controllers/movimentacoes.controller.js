const db = require('../db');

/**
 * Listagem global de movimentações com filtros:
 *  - data_inicio / data_fim  (intervalo de datas)
 *  - grupo                   (grupo do material, ILIKE)
 *  - codigo                  (código do material, ILIKE)
 *  - tipo                    (entrada | saida | ajuste)
 *  - page / limit            (paginação)
 */
exports.list = async (req, res) => {
  const {
    data_inicio,
    data_fim,
    grupo,
    codigo,
    tipo,
    page = 1,
    limit = 50
  } = req.query;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  try {
    const params = [];
    const whereClauses = [];

    if (data_inicio) {
      params.push(data_inicio);
      whereClauses.push(`mv.realizado_em >= $${params.length}::date`);
    }
    if (data_fim) {
      params.push(data_fim);
      whereClauses.push(`mv.realizado_em < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (tipo && ['entrada', 'saida', 'ajuste'].includes(tipo)) {
      params.push(tipo);
      whereClauses.push(`mv.tipo = $${params.length}`);
    }
    if (codigo) {
      params.push(`%${codigo.trim()}%`);
      whereClauses.push(`m.codigo ILIKE $${params.length}`);
    }
    if (grupo) {
      params.push(`%${grupo.trim()}%`);
      whereClauses.push(`m.grupo ILIKE $${params.length}`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Contagem total para paginação
    const countParams = [...params];
    const countQuery = `
      SELECT COUNT(*) 
      FROM movimentacoes mv
      JOIN materiais m ON mv.material_id = m.id
      ${whereString}
    `;
    const countResult = await db.query(countQuery, countParams);
    const totalItems = parseInt(countResult.rows[0].count, 10);

    // Query principal com joins
    params.push(parseInt(limit, 10));
    const limitPlaceholder = `$${params.length}`;
    params.push(offset);
    const offsetPlaceholder = `$${params.length}`;

    const selectQuery = `
      SELECT
        mv.id,
        mv.tipo,
        mv.quantidade::FLOAT           AS quantidade,
        mv.motivo,
        mv.realizado_em,
        m.codigo                       AS material_codigo,
        m.grupo                        AS material_grupo,
        m.descricao                    AS material_descricao,
        m.unidade                      AS material_unidade,
        u.nome                         AS realizado_por,
        p.codigo_projeto               AS projeto_codigo,
        p.nome                         AS projeto_nome
      FROM movimentacoes mv
      JOIN materiais m  ON mv.material_id   = m.id
      JOIN usuarios  u  ON mv.realizado_por = u.id
      LEFT JOIN projetos p ON mv.projeto_id = p.id
      ${whereString}
      ORDER BY mv.realizado_em DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const { rows } = await db.query(selectQuery, params);

    return res.json({
      movimentacoes: rows,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / parseInt(limit, 10)),
        currentPage: parseInt(page, 10),
        itemsPerPage: parseInt(limit, 10)
      }
    });

  } catch (error) {
    console.error('Erro ao listar movimentações:', error);
    return res.status(500).json({ error: 'Erro ao buscar histórico de movimentações.' });
  }
};
