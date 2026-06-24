const express = require('express');
const movimentacoesController = require('../controllers/movimentacoes.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

// Listagem global de movimentações com filtros de data, grupo e código
router.get(
  '/',
  authenticateToken,
  authorizeRoles('administrador', 'almoxarife', 'engenharia', 'compras'),
  movimentacoesController.list
);

module.exports = router;
