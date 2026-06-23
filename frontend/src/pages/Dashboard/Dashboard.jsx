import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Package, 
  FolderKanban, 
  AlertTriangle, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw 
} from 'lucide-react';
import './Dashboard.css';

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/dashboard');
      setStats(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getMovementTypeBadge = (tipo) => {
    switch (tipo) {
      case 'entrada':
        return <span className="badge badge-success">Entrada</span>;
      case 'saida':
        return <span className="badge badge-error">Saída</span>;
      case 'ajuste':
        return <span className="badge badge-info">Ajuste</span>;
      default:
        return <span className="badge">{tipo}</span>;
    }
  };

  if (loading && !stats) {
    return <div className="loading-state">Carregando painel operacional...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-actions">
        <p className="dashboard-subtitle">Monitoramento em tempo real do almoxarifado de transformadores</p>
        <button onClick={fetchStats} className="btn btn-outline btn-refresh" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Atualizar Dados
        </button>
      </div>

      {error && <div className="login-alert alert-error">{error}</div>}

      {/* METRICAS CHAVE */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper bg-steel-blue">
            <Package size={24} className="text-white" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Catálogo de Materiais</span>
            <span className="stat-value">{stats?.totalMateriais || 0}</span>
            <small className="stat-helper">Itens ativos no sistema</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper bg-charcoal">
            <FolderKanban size={24} className="text-white" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Projetos Ativos</span>
            <span className="stat-value">{stats?.totalProjetosAtivos || 0}</span>
            <small className="stat-helper">Em planejamento ou produção</small>
          </div>
        </div>

        <div className="stat-card border-ruptura">
          <div className="stat-icon-wrapper bg-ruptura">
            <Flame size={24} className="text-white animate-pulse" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Itens em Ruptura</span>
            <span className="stat-value text-error">
              {stats?.itensRuptura || 0}
            </span>
            <small className="stat-helper text-error-msg">Abaixo da necessidade dos projetos</small>
          </div>
        </div>

        <div className="stat-card border-critical">
          <div className="stat-icon-wrapper bg-critical">
            <AlertTriangle size={24} className="text-white" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Estoque Crítico</span>
            <span className="stat-value text-warning">{stats?.estoqueCritico || 0}</span>
            <small className="stat-helper text-warning-msg">Abaixo de 10% do pico histórico</small>
          </div>
        </div>
      </div>

      {/* PAINEL OPERACIONAL E MOVIMENTAÇÕES */}
      <div className="dashboard-content-grid">
        <div className="card-panel">
          <div className="panel-header">
            <h3>Últimas 5 Movimentações Físicas</h3>
          </div>
          <div className="panel-body">
            {stats?.lastMovements && stats.lastMovements.length > 0 ? (
              <div className="table-container">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Horário</th>
                      <th>Material</th>
                      <th>Tipo</th>
                      <th>Quantidade</th>
                      <th>Motivo / Justificativa</th>
                      <th>Operador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.lastMovements.map((mov) => (
                      <tr key={mov.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {new Date(mov.realizado_em).toLocaleString('pt-BR')}
                        </td>
                        <td className="tech-code">{mov.material_codigo}</td>
                        <td>{getMovementTypeBadge(mov.tipo)}</td>
                        <td className="tech-number">
                          {mov.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                        </td>
                        <td className="text-truncated" title={mov.motivo}>
                          {mov.motivo}
                        </td>
                        <td style={{ fontWeight: 500 }}>{mov.realizado_por_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                Nenhuma movimentação física registrada no estoque até o momento.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
