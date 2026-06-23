const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./index');

async function setupDatabase() {
  try {
    console.log('Iniciando configuração do banco de dados...');
    
    // Ler arquivo schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    // Executar schema SQL
    await db.query(sql);
    console.log('Tabelas e índices criados com sucesso!');
    
    // Verificar se já existem usuários
    const { rows } = await db.query('SELECT COUNT(*) FROM usuarios');
    const count = parseInt(rows[0].count, 10);
    
    if (count === 0) {
      console.log('Semeando usuários padrão (seeds)...');
      
      const seedUsers = [
        { nome: 'Administrador NovaFlux', email: 'admin@novaflux.com', senha: 'adminPassword123', perfil: 'administrador' },
        { nome: 'Almoxarife NovaFlux', email: 'almoxarife@novaflux.com', senha: 'almoxarife123', perfil: 'almoxarife' },
        { nome: 'Engenheiro NovaFlux', email: 'engenharia@novaflux.com', senha: 'engenharia123', perfil: 'engenharia' },
        { nome: 'Comprador NovaFlux', email: 'compras@novaflux.com', senha: 'compras123', perfil: 'compras' }
      ];
      
      for (const u of seedUsers) {
        const hash = await bcrypt.hash(u.senha, 12);
        await db.query(
          'INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES ($1, $2, $3, $4, TRUE)',
          [u.nome, u.email, hash, u.perfil]
        );
        console.log(`Usuário semeado: ${u.email} (${u.perfil})`);
      }
    } else {
      console.log('Usuários já cadastrados. Pulando semeadura.');
    }
    
    console.log('Configuração do banco de dados concluída!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao configurar banco de dados:', error);
    process.exit(1);
  }
}

setupDatabase();
