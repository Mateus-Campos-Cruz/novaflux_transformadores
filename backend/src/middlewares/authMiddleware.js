const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_novaflux_access_token_key_2026';

/**
 * Middleware para validar o token de acesso JWT.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Sessão expirada. Por favor, faça login novamente ou atualize o token.', 
          code: 'TOKEN_EXPIRED' 
        });
      }
      return res.status(403).json({ error: 'Token inválido ou corrompido.' });
    }
    
    // Anexa as informações básicas do usuário decodificadas à requisição
    req.user = {
      id: decoded.id,
      nome: decoded.nome,
      email: decoded.email,
      perfil: decoded.perfil
    };
    
    next();
  });
}

/**
 * Middleware para autorizar perfis de usuário específicos.
 * 
 * @param {...String} allowedProfiles - Lista de perfis permitidos
 */
function authorizeRoles(...allowedProfiles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (!allowedProfiles.includes(req.user.perfil)) {
      return res.status(403).json({ 
        error: `Acesso negado. Perfil '${req.user.perfil}' não tem permissão para esta ação.` 
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles
};
