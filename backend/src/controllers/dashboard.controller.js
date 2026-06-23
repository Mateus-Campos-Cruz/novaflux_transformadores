const db = require('../db');

exports.getStats = async (req, res) => {
  try {
    // 1. Total de materiais cadastrados e ativos
    const matCountRes = await db.query('SELECT COUNT(*)::INT as count FROM materiais WHERE ativo = TRUE');
    const totalMateriais = matCountRes.rows[0].count;

    // 2. Total de projetos ativos (não encerrados)
    const projCountRes = await db.query(
      `SELECT COUNT(*)::INT as count FROM projetos WHERE status IN ('planejamento', 'reserva_ativa', 'em_producao') AND ativo = TRUE`
    );
    const totalProjetosAtivos = projCountRes.rows[0].count;

    // 3. Quantidade de itens em alerta de ruptura (badge vermelho com número)
    // Itens necessários em projetos ativos onde o disponível líquido total do material é inferior ao necessário pendente
    const ruptureCountRes = await db.query(`
      SELECT COUNT(DISTINCT lm.material_id)::INT as count
      FROM lista_materiais lm
      JOIN projetos p ON lm.projeto_id = p.id
      JOIN materiais m ON lm.material_id = m.id
      LEFT JOIN (
        SELECT projeto_id, material_id, SUM(quantidade_reservada) as total_reservado_projeto
        FROM reservas
        WHERE status = 'ativa'
        GROUP BY projeto_id, material_id
      ) rp ON lm.projeto_id = rp.projeto_id AND lm.material_id = rp.material_id
      LEFT JOIN (
        SELECT material_id, SUM(quantidade_reservada) as total_reservado_global
        FROM reservas
        WHERE status = 'ativa'
        GROUP BY material_id
      ) rg ON lm.material_id = rg.material_id
      WHERE p.status IN ('planejamento', 'reserva_ativa', 'em_producao')
        AND p.ativo = TRUE
        AND m.ativo = TRUE
        AND (lm.quantidade_necessaria - COALESCE(rp.total_reservado_projeto, 0)) > 0
        AND (m.quantidade_fisica - COALESCE(rg.total_reservado_global, 0)) < (lm.quantidade_necessaria - COALESCE(rp.total_reservado_projeto, 0))
    `);
    const itensRuptura = ruptureCountRes.rows[0].count;

    // 4. Quantidade de materiais com estoque crítico (abaixo de 10% do histórico)
    // Histórico de pico é o maior valor entre a quantidade atual e os registros históricos de movimentações
    const criticalCountRes = await db.query(`
      SELECT COUNT(*)::INT as count
      FROM materiais m
      WHERE m.ativo = TRUE
        AND m.quantidade_fisica < 0.10 * COALESCE(
          (
            SELECT MAX(quantidade_pico)
            FROM (
              SELECT m.quantidade_fisica as quantidade_pico
              UNION
              SELECT quantidade as quantidade_pico FROM movimentacoes WHERE material_id = m.id
            ) as sub
          ), 
          1.0
        )
        AND m.quantidade_fisica > 0 -- Itens zerados não entram como críticos se já nasceram zerados e nunca tiveram estoque
    `);
    const estoqueCritico = criticalCountRes.rows[0].count;

    // 5. Últimas 5 movimentações registradas
    const lastMovementsRes = await db.query(`
      SELECT 
        mv.id,
        mv.tipo,
        mv.quantidade::FLOAT as quantidade,
        mv.motivo,
        mv.realizado_em,
        m.codigo as material_codigo,
        u.nome as realizado_por_nome
      FROM movimentacoes mv
      JOIN materiais m ON mv.material_id = m.id
      JOIN usuarios u ON mv.realizado_por = u.id
      ORDER BY mv.realizado_em DESC
      LIMIT 5
    `);

    return res.json({
      totalMateriais,
      totalProjetosAtivos,
      itensRuptura,
      estoqueCritico,
      lastMovements: lastMovementsRes.rows
    });

  } catch (error) {
    console.error('Erro ao compilar estatísticas do dashboard:', error);
    return res.status(500).json({ error: 'Erro ao carregar dados do dashboard.' });
  }
};
