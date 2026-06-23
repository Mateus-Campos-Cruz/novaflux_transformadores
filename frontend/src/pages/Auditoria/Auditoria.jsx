import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Search, Calendar, RefreshCw } from 'lucide-react';
import './Auditoria.css';

export const Auditoria = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [userQuery, setUserQuery] = useState('');
  const [actionQuery, setActionQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (userQuery) params.append('usuario', userQuery);
      if (actionQuery) params.append('acao', actionQuery);
      if (startDate) params.append('data_inicio', startDate);
      if (endDate) params.append('data_fim', endDate);

      const data = await api.get(`/auditoria?${params.toString()}`);
      setLogs(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar logs de auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [userQuery, actionQuery, startDate, endDate]);

  const handleClearFilters = () => {
    setUserQuery('');
    setActionQuery('');
    setStartDate('');
    setEndDate('');
  };

  const getActionBadgeClass = (acao) => {
    if (acao.includes('bloqueado') || acao.includes('cancelada')) return 'badge-error';
    if (acao.includes('sucesso') || acao.includes('criado') || acao.includes('importado') || acao.includes('liberadas')) return 'badge-success';
    return 'badge-info';
  };

  if (user?.perfil !== 'administrador') {
    return (
      <div className="login-alert alert-error" style={{ margin: '2rem auto', maxWidth: '600px' }}>
        <ShieldAlert size={24} />
        <div>
          <h3 style={{ margin: 0, fontWeight: 700 }}>Acesso Bloqueado</h3>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Apenas usuários com o perfil de Administrador possuem privilégios para visualizar os logs de auditoria.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auditoria-container">
      <div className="dashboard-actions">
        <p className="dashboard-subtitle">Visualização de trilhas de auditoria, eventos de login e IP de origem das ações</p>
        <button onClick={fetchLogs} className="btn btn-outline" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar Logs
        </button>
      </div>

      {error && <div className="login-alert alert-error">{error}</div>}

      {/* FILTROS CARD */}
      <div className="filter-card">
        <div className="filter-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="form-group">
            <label className="form-label">Usuário (Nome/E-mail)</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ex: admin, almoxarife" 
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Ação / Evento</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ex: login_sucesso, reserva" 
              value={actionQuery}
              onChange={(e) => setActionQuery(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Data Início</label>
            <input 
              type="date" 
              className="form-control" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Data Fim</label>
            <input 
              type="date" 
              className="form-control" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button onClick={handleClearFilters} className="btn btn-outline" style={{ height: '38px', marginBottom: '4px' }}>
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* TABELA DE AUDITORIA */}
      {loading ? (
        <div className="loading-state">Carregando logs de auditoria...</div>
      ) : logs.length > 0 ? (
        <div className="table-container">
          <table className="erp-table mobile-cards-table">
            <thead>
              <tr>
                <th>Horário</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Tabela Afetada</th>
                <th>ID Registro</th>
                <th>IP Origem</th>
                <th>Detalhes / Histórico</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td data-label="Horário" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(log.realizado_em).toLocaleString('pt-BR')}
                  </td>
                  <td data-label="Usuário" style={{ fontWeight: 600 }}>
                    {log.usuario_nome || 'Sistema'} 
                    {log.usuario_email && <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400 }}>{log.usuario_email}</span>}
                  </td>
                  <td data-label="Ação">
                    <span className={`badge ${getActionBadgeClass(log.acao)}`}>
                      {log.acao}
                    </span>
                  </td>
                  <td data-label="Tabela Afetada" style={{ fontWeight: 500 }}>{log.tabela_afetada}</td>
                  <td data-label="ID Registro" className="tech-code" style={{ fontSize: '0.75rem' }}>{log.registro_id || '-'}</td>
                  <td data-label="IP Origem" className="tech-code">{log.ip_origem}</td>
                  <td data-label="Detalhes" className="desc-cell" style={{ maxWidth: '300px' }} title={log.detalhe}>{log.detalhe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">Nenhum evento registrado com as especificações de busca.</div>
      )}
    </div>
  );
};
