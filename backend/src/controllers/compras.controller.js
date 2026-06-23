const db = require('../db');

// 1. Obter a visão consolidada de itens em ruptura para compras
exports.listRupturas = async (req, res) => {
  try {
    // Buscar todos os requisitos de materiais dos projetos ativos
    const query = `
      SELECT 
        lm.material_id,
        m.codigo as material_codigo,
        m.descricao as material_descricao,
        m.unidade as material_unidade,
        p.id as projeto_id,
        p.codigo_projeto,
        p.nome as projeto_nome,
        lm.quantidade_necessaria::FLOAT as quantidade_necessaria,
        COALESCE(rp.total_reservado_projeto, 0)::FLOAT as quantidade_reservada,
        (m.quantidade_fisica - COALESCE(rg.total_reservado_global, 0))::FLOAT as disponivel_liquido
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
      ORDER BY m.codigo ASC, p.codigo_projeto ASC
    `;

    const { rows } = await db.query(query);

    // Agrupar por material
    const agrupado = {};

    for (const row of rows) {
      const {
        material_id,
        material_codigo,
        material_descricao,
        material_unidade,
        projeto_id,
        codigo_projeto,
        projeto_nome,
        quantidade_necessaria,
        quantidade_reservada,
        disponivel_liquido
      } = row;

      const pendente = quantidade_necessaria - quantidade_reservada;

      if (pendente <= 0) continue; // Totalmente atendido para este projeto

      if (!agrupado[material_id]) {
        agrupado[material_id] = {
          id: material_id,
          codigo: material_codigo,
          descricao: material_descricao,
          unidade: material_unidade,
          disponivel_liquido: disponivel_liquido, // É o mesmo estoque líquido para o material em todo o banco
          total_pendente: 0,
          projetos: []
        };
      }

      agrupado[material_id].total_pendente += pendente;
      agrupado[material_id].projetos.push({
        projeto_id,
        codigo_projeto,
        projeto_nome,
        quantidade_necessaria,
        quantidade_reservada,
        quantidade_pendente: pendente
      });
    }

    // Filtrar apenas materiais que possuem pendência superior ao disponível líquido (ruptura real)
    const listRupturas = [];

    for (const key in agrupado) {
      const mat = agrupado[key];
      const dispLiq = mat.disponivel_liquido;
      const totalPendente = mat.total_pendente;

      // Se o total pendente entre todos os projetos é maior que o estoque livre no almoxarifado, há ruptura
      if (totalPendente > dispLiq) {
        // Quantidade faltante total a ser comprada
        const quantidade_falta = totalPendente - Math.max(0, dispLiq);

        listRupturas.push({
          id: mat.id,
          codigo: mat.codigo,
          descricao: mat.descricao,
          unidade: mat.unidade,
          disponivel_liquido: dispLiq,
          total_pendente: totalPendente,
          quantidade_comprar: quantidade_falta,
          projetos: mat.projetos
        });
      }
    }

    return res.json(listRupturas);

  } catch (error) {
    console.error('Erro ao compilar rupturas para compras:', error);
    return res.status(500).json({ error: 'Erro ao compilar dados da área de compras.' });
  }
};
