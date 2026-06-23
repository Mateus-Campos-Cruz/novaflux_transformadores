const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', authenticateToken, dashboardController.getStats);

module.exports = router;
