const express = require('express');
const multer = require('multer');
const materiaisController = require('../controllers/materiais.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

// Configuração do multer para upload em memória, limitado a 10MB e apenas extensões csv/xlsx
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const isExcel = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.mimetype === 'application/vnd.ms-excel' ||
                    file.originalname.endsWith('.xlsx') || 
                    file.originalname.endsWith('.xls');
                    
    const isCsv = file.mimetype === 'text/csv' || 
                  file.mimetype === 'application/csv' ||
                  file.originalname.endsWith('.csv');

    if (isExcel || isCsv) {
      cb(null, true);
    } else {
      cb(new Error('Apenas uploads de planilhas nos formatos .xlsx ou .csv são permitidos.'));
    }
  }
});

// Middleware auxiliar de tratamento de erro do Multer para retornar JSON estruturado
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'O tamanho do arquivo excede o limite permitido de 10MB.' });
    }
    return res.status(400).json({ error: `Erro no upload do arquivo: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Rotas de materiais com autorizações específicas
router.get('/', authenticateToken, authorizeRoles('administrador', 'almoxarife', 'engenharia', 'compras'), materiaisController.list);

router.post('/', authenticateToken, authorizeRoles('administrador', 'almoxarife', 'engenharia'), materiaisController.create);

router.post('/:id/movimentar', authenticateToken, authorizeRoles('administrador', 'almoxarife', 'engenharia'), materiaisController.adjustQuantity);

router.get('/:id/movimentacoes', authenticateToken, authorizeRoles('administrador', 'almoxarife', 'engenharia'), materiaisController.getMovements);

router.post(
  '/import', 
  authenticateToken, 
  authorizeRoles('administrador', 'almoxarife', 'engenharia'), 
  upload.single('planilha'), 
  handleUploadError, 
  materiaisController.importCatalog
);

module.exports = router;
