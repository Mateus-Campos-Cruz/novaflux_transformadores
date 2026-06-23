const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { logAudit } = require('../utils/auditHelper');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_novaflux_access_token_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_novaflux_refresh_token_key_2026';

// Armazenamento em memória para Refresh Tokens ativos (para rotação)
// Chave: refreshToken, Valor: { userId, perfil, nome, email }
const activeRefreshTokens = new Map();

/**
 * Função utilitária para gerar os tokens de acesso e refresh.
 */
function generateTokens(user) {
  const payload = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
}

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    // Buscar usuário pelo e-mail
    const { rows } = await db.query(
      'SELECT id, nome, email, senha_hash, perfil, ativo, tentativas_login, bloqueado_ate FROM usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      // Retorna erro genérico para evitar enumeração de usuários
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = rows[0];

    // Verificar se o usuário está ativo
    if (!user.ativo) {
      return res.status(403).json({ error: 'Esta conta está desativada. Entre em contato com o administrador.' });
    }

    // Verificar se a conta está bloqueada temporariamente
    if (user.bloqueado_ate) {
      const lockTime = new Date(user.bloqueado_ate);
      const now = new Date();
      if (lockTime > now) {
        const remainingMinutes = Math.ceil((lockTime - now) / (60 * 1000));
        return res.status(423).json({ 
          error: `Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em ${remainingMinutes} minuto(s).` 
        });
      }
    }

    // Comparar senhas
    const isMatch = await bcrypt.compare(password, user.senha_hash);

    if (!isMatch) {
      // Incrementar tentativas de login incorretas
      const newAttempts = (user.tentativas_login || 0) + 1;
      
      if (newAttempts >= 5) {
        // Bloquear conta por 15 minutos
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
        await db.query(
          'UPDATE usuarios SET tentativas_login = $1, bloqueado_ate = $2 WHERE id = $3',
          [newAttempts, lockUntil, user.id]
        );
        
        await logAudit(user.id, 'login_bloqueado', 'usuarios', user.id, 'Conta bloqueada temporariamente por 5 tentativas falhas', req.ip);

        return res.status(423).json({ 
          error: 'Conta bloqueada por excesso de tentativas. Tente novamente após 15 minutos.' 
        });
      } else {
        await db.query(
          'UPDATE usuarios SET tentativas_login = $1 WHERE id = $2',
          [newAttempts, user.id]
        );
        
        return res.status(401).json({ 
          error: `Credenciais inválidas. Tentativa ${newAttempts} de 5.` 
        });
      }
    }

    // Login com sucesso: Resetar tentativas de login
    await db.query(
      'UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL WHERE id = $1',
      [user.id]
    );

    // Gerar tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Salvar refresh token em memória para controle de rotação
    activeRefreshTokens.set(refreshToken, {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil
    });

    // Registrar auditoria de login
    await logAudit(user.id, 'login_sucesso', 'usuarios', user.id, 'Login efetuado com sucesso', req);

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil
      }
    });

  } catch (error) {
    console.error('Erro na rota de login:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token é obrigatório.' });
  }

  // Verificar se o refresh token é conhecido e está ativo
  if (!activeRefreshTokens.has(refreshToken)) {
    return res.status(403).json({ error: 'Refresh token expirado ou inválido.' });
  }

  try {
    // Verificar assinatura e validade do token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Obter dados salvos
    const userPayload = activeRefreshTokens.get(refreshToken);

    // Rotação: Remover o refresh token anterior
    activeRefreshTokens.delete(refreshToken);

    // Buscar no banco se o usuário continua ativo
    const { rows } = await db.query('SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = $1', [decoded.id]);
    
    if (rows.length === 0 || !rows[0].ativo) {
      return res.status(403).json({ error: 'Usuário inativo ou não cadastrado.' });
    }

    const user = rows[0];

    // Gerar novo par de tokens
    const tokens = generateTokens(user);

    // Registrar novo refresh token na memória
    activeRefreshTokens.set(tokens.refreshToken, {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil
    });

    return res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });

  } catch (error) {
    // Se falhar a assinatura ou expirar, removemos o token ativo
    activeRefreshTokens.delete(refreshToken);
    return res.status(403).json({ error: 'Refresh token inválido ou expirado.' });
  }
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    activeRefreshTokens.delete(refreshToken);
  }

  // Registrar auditoria se o usuário estiver autenticado no momento do logout
  if (req.user) {
    await logAudit(req.user.id, 'logout', 'usuarios', req.user.id, 'Logout realizado com sucesso', req);
  }

  return res.json({ message: 'Logout realizado com sucesso.' });
};
