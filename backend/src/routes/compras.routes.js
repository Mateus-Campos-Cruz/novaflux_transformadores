const express = require('express');
const comprasController = require('../controllers/compras.controller');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// A área de compras consolidada de rupturas pode ser acessada por todos para transparência de estoque,
// especialmente o perfil 'compras' e 'administrador'.
router.get('/rupturas', authenticateToken, comprasController.listRupturas);

module.exports = router;
