const express = require('express');
const reservasController = require('../controllers/reservas.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

// Apenas administrador, almoxarife e engenharia gerenciam ou consultam reservas detalhadas
// O perfil compras é restrito das rotas de reserva e movimentação

router.get('/', authenticateToken, authorizeRoles('administrador', 'almoxarife', 'engenharia'), reservasController.listActive);
router.post('/', authenticateToken, authorizeRoles('administrador', 'almoxarife', 'engenharia'), reservasController.create);
router.post('/:id/cancelar', authenticateToken, authorizeRoles('administrador', 'almoxarife', 'engenharia'), reservasController.cancel);
router.get('/historico', authenticateToken, authorizeRoles('administrador', 'almoxarife', 'engenharia'), reservasController.getHistory);

module.exports = router;
