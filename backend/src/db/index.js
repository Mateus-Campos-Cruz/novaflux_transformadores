const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

// Neon/Render PostgreSQL exigem SSL em produção. 
// Vamos habilitar SSL se a conexão contiver neon.tech ou se NODE_ENV for production.
const useSSL = connectionString && (connectionString.includes('neon.tech') || process.env.NODE_ENV === 'production');

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
