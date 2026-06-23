const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Rate limiting para rota de login: máximo de 10 requisições por minuto por IP
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10,
  message: { error: 'Muitas requisições de login a partir deste IP. Tente novamente em 1 minuto.' },
  standardHeaders: true, // Retorna informação de limite no header
  legacyHeaders: false, // Desabilita o X-RateLimit-* header legado
});

router.post('/login', loginLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);

// Logout pode receber token de acesso opcional para logar de forma auditável
router.post('/logout', (req, res, next) => {
  // Executa autenticação apenas se o header estiver presente, senão vai direto pro logout
  if (req.headers['authorization']) {
    return authenticateToken(req, res, next);
  }
  next();
}, authController.logout);

module.exports = router;
