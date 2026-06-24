const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const materiaisRoutes = require('./routes/materiais.routes');
const projetosRoutes = require('./routes/projetos.routes');
const reservasRoutes = require('./routes/reservas.routes');
const comprasRoutes = require('./routes/compras.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Middlewares Globais de Segurança e Utilidades
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  },
  xssFilter: true,
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

// CORS configurado dinamicamente via arquivo de ambiente
const allowedOrigins = [
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'https://mateus-campos-cruz.github.io'
];
app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (ex: Postman, mobile) e origins na lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqueado para: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// 2. Registro das Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/materiais', materiaisRoutes);
app.use('/api/projetos', projetosRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Rota de verificação de status (Health Check)
app.get('/health', (req, res) => {
  return res.json({ status: 'ok', timestamp: new Date(), version: '1.0.0' });
});

// 3. Tratamento Centralizado de Rotas Não Encontradas (404)
app.use((req, res, next) => {
  return res.status(404).json({ error: 'Recurso não encontrado no servidor.' });
});

// 4. Tratamento Centralizado de Erros (500)
app.use((err, req, res, next) => {
  console.error('Erro não tratado capturado pelo middleware:', err);
  return res.status(500).json({ 
    error: 'Ocorreu um erro interno no servidor.', 
    details: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// 5. Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Servidor NovaFlux Almoxarifado rodando na porta ${PORT}`);
  console.log(` Origem CORS permitida: ${allowedOrigin}`);
  console.log(` Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================`);
});
