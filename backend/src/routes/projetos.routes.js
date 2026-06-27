const express = require('express');
const multer = require('multer');
const projetosController = require('../controllers/projetos.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Listar todos os projetos
router.get('/', authenticateToken, projetosController.list);

// Obter próximo código sugerido de projeto (automático)
router.get('/next-code', authenticateToken, projetosController.getNextCode);

// Cadastrar novo projeto
router.post('/', authenticateToken, authorizeRoles('administrador', 'engenharia'), projetosController.create);

// Obter detalhes de um projeto e sua lista técnica
router.get('/:id', authenticateToken, projetosController.getById);

// Atualizar dados de um projeto (inclui encerramento que libera reservas)
router.put('/:id', authenticateToken, authorizeRoles('administrador', 'engenharia'), projetosController.update);

// Importar lista técnica do projeto
router.post(
  '/:id/import-lista',
  authenticateToken,
  authorizeRoles('administrador', 'engenharia'),
  upload.single('planilha'),
  projetosController.importTechnicalList
);

// Reservar em lote os itens disponíveis para o projeto
router.post('/:id/reservar-lote', authenticateToken, authorizeRoles('administrador', 'almoxarife', 'engenharia'), projetosController.reserveBatch);

// Relatório de pendências de ruptura do projeto
router.get('/:id/pendencias', authenticateToken, projetosController.getPendencies);

// Adicionar item manualmente à lista técnica
router.post('/:id/lista-materiais', authenticateToken, authorizeRoles('administrador', 'engenharia', 'almoxarife'), projetosController.addItem);

// Remover item da lista técnica
router.delete('/:id/lista-materiais/:itemId', authenticateToken, authorizeRoles('administrador', 'engenharia', 'almoxarife'), projetosController.removeItem);

module.exports = router;
