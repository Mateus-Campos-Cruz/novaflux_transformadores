const db = require('../db');

/**
 * Registra uma ação no histórico de auditoria (audit_log).
 * Pode receber o objeto Express 'req' para extrair automaticamente o usuário autenticado e o IP de origem.
 * 
 * @param {Object|String} reqOrUserId - Objeto de requisição Express ou ID do usuário diretamente
 * @param {String} acao - Ação realizada (ex: 'reserva_criada', 'material_importado')
 * @param {String} tabelaAfetada - Nome da tabela afetada (ex: 'materiais', 'reservas')
 * @param {String} [registroId=null] - UUID do registro afetado
 * @param {String} [detalhe=null] - Detalhes adicionais textuais ou JSON
 * @param {String} [ip=null] - IP de origem manual (se não fornecido via req)
 */
async function logAudit(reqOrUserId, acao, tabelaAfetada, registroId = null, detalhe = null, ip = null) {
  try {
    let usuarioId = null;
    let ipOrigem = ip;

    if (reqOrUserId && typeof reqOrUserId === 'object') {
      // Extrair do Express Request
      if (reqOrUserId.user) {
        usuarioId = reqOrUserId.user.id;
      }
      ipOrigem = reqOrUserId.headers['x-forwarded-for'] || 
                 reqOrUserId.ip || 
                 (reqOrUserId.socket && reqOrUserId.socket.remoteAddress) || 
                 reqOrUserId.connection?.remoteAddress;
    } else if (reqOrUserId) {
      usuarioId = reqOrUserId;
    }

    // Normalizar IP local
    if (ipOrigem === '::1' || ipOrigem === '::ffff:127.0.0.1') {
      ipOrigem = '127.0.0.1';
    }

    // Se vier do header x-forwarded-for, pode ser uma lista (ex: "client, proxy1, proxy2")
    if (ipOrigem && ipOrigem.includes(',')) {
      ipOrigem = ipOrigem.split(',')[0].trim();
    }

    await db.query(
      `INSERT INTO audit_log (usuario_id, acao, tabela_afetada, registro_id, detalhe, ip_origem)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuarioId, acao, tabelaAfetada, registroId, detalhe, ipOrigem || 'desconhecido']
    );
  } catch (error) {
    console.error('Falha crítica ao gravar log de auditoria:', error);
  }
}

module.exports = { logAudit };
