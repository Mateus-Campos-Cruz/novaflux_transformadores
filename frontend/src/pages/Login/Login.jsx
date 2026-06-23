import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Eye, EyeOff } from 'lucide-react';
import './Login.css';

export const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState(false);

  useEffect(() => {
    // Redireciona se o usuário já estiver logado
    if (isAuthenticated) {
      navigate('/');
    }
    if (searchParams.get('expired') === 'true') {
      setSessionExpiredMsg(true);
    }
  }, [isAuthenticated, navigate, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSessionExpiredMsg(false);

    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Falha na autenticação. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-header">
          <h1>NOVA<span>FLUX</span></h1>
          <p>SISTEMA DE GESTÃO DE ALMOXARIFADO</p>
        </div>

        {sessionExpiredMsg && (
          <div className="login-alert alert-warning">
            Sessão expirada por inatividade. Faça login novamente.
          </div>
        )}

        {error && (
          <div className="login-alert alert-error">
            <ShieldAlert size={18} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">E-mail Corporativo</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="exemplo@novaflux.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group password-group">
            <label className="form-label" htmlFor="password">Senha de Acesso</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="login-footer">
          <p>Uso Restrito à NovaFlux Transformadores.</p>
          <small>Acesso seguro monitorado e auditado por IP.</small>
        </div>
      </div>
    </div>
  );
};
