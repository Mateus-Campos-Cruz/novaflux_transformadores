const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Cache em memória dos tokens para velocidade
let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');

// Listeners para notificar o AuthContext sobre alterações nos tokens
const tokenListeners = new Set();

export const subscribeToTokenChanges = (listener) => {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
};

const notifyTokenChanges = (user) => {
  for (const listener of tokenListeners) {
    listener(user);
  }
};

/**
 * Define os tokens no local storage e na memória.
 */
export const setTokens = (access, refresh, user = null) => {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    localStorage.setItem('accessToken', access);
  } else {
    localStorage.removeItem('accessToken');
  }
  if (refresh) {
    localStorage.setItem('refreshToken', refresh);
  } else {
    localStorage.removeItem('refreshToken');
  }
  notifyTokenChanges(user);
};

/**
 * Remove os tokens limpando a sessão.
 */
export const clearTokens = () => {
  setTokens(null, null, null);
  localStorage.removeItem('user');
};

/**
 * Realiza a chamada de Refresh Token no backend.
 */
async function refreshSession() {
  const refresh = localStorage.getItem('refreshToken');
  if (!refresh) {
    throw new Error('Nenhum refresh token disponível.');
  }

  const response = await fetch(`${BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh })
  });

  if (!response.ok) {
    throw new Error('Falha ao renovar sessão.');
  }

  const data = await response.json();
  // Salvar novos tokens
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

/**
 * Wrapper customizado do fetch para chamadas de API autenticadas.
 */
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  
  // Garantir que headers existam
  options.headers = options.headers || {};
  
  // Anexar token se existir
  if (accessToken) {
    options.headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, options);

  // Se o token de acesso expirou, tenta rodar o refresh token
  if (response.status === 401) {
    try {
      const data = await response.clone().json();
      if (data.code === 'TOKEN_EXPIRED') {
        console.log('Token expirado capturado. Tentando renovação automática...');
        const newAccess = await refreshSession();
        
        // Refazer a requisição original com o novo token
        options.headers['Authorization'] = `Bearer ${newAccess}`;
        response = await fetch(url, options);
      }
    } catch (refreshError) {
      console.warn('Sessão expirada permanentemente. Redirecionando para login.');
      clearTokens();
      // Redireciona via window.location se estiver fora do React Router
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = '/login?expired=true';
      }
    }
  }

  // Se a resposta ainda falhar, tenta ler o JSON de erro do backend
  if (!response.ok) {
    let errMsg = 'Erro na comunicação com o servidor.';
    try {
      const errData = await response.json();
      errMsg = errData.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return response.json();
};

export const api = {
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body)
  }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, {
    ...options,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body)
  }),
  delete: (endpoint, body, options = {}) => apiRequest(endpoint, {
    ...options,
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: body ? JSON.stringify(body) : undefined
  }),
  upload: (endpoint, formData, options = {}) => apiRequest(endpoint, {
    ...options,
    method: 'POST',
    headers: { ...options.headers }, // Deixar o navegador setar o Content-Type com o boundary correto
    body: formData
  })
};
