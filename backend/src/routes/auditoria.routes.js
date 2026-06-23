const express = require('express');
const auditoriaController = require('../controllers/auditoria.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

// Apenas o perfil 'administrador' pode visualizar a tela de auditoria
router.get('/', authenticateToken, authorizeRoles('administrador'), auditoriaController.listLogs);

module.exports = router;
