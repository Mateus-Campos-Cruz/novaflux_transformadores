import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { BookmarkCheck, History, X, Search } from 'lucide-react';
import './Reservas.css';

export const Reservas = () => {
  const [activeTab, setActiveTab] = useState('ativas'); // 'ativas' ou 'historico'
  
  // Dados e filtros
  const [reserves, setReserves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [materialQuery, setMaterialQuery] = useState('');

  // Cancelamento
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReserve, setSelectedReserve] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const fetchReserves = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = activeTab === 'ativas' ? '/reservas' : '/reservas/historico';
      const data = await api.get(endpoint);
      setReserves(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados de reservas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReserves();
  }, [activeTab]);

  const handleCancelClick = (res) => {
    setSelectedReserve(res);
    setCancelReason('');
    setCancelError('');
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    setCancelError('');

    if (!cancelReason.trim()) {
      setCancelError('O motivo do cancelamento é obrigatório.');
      return;
    }

    try {
      await api.post(`/reservas/${selectedReserve.id}/cancelar`, {
        motivo: cancelReason
      });
      
      setCancelModalOpen(false);
      fetchReserves();
    } catch (err) {
      setCancelError(err.message);
    }
  };

  // Filtragem no frontend para facilidade e dinamismo de busca imediata
  const filteredReserves = reserves.filter(res => {
    const matchesProject = res.projeto_codigo.toLowerCase().includes(projectQuery.toLowerCase()) || 
                          res.projeto_nome.toLowerCase().includes(projectQuery.toLowerCase());
    const matchesMaterial = res.material_codigo.toLowerCase().includes(materialQuery.toLowerCase()) || 
                           res.material_descricao.toLowerCase().includes(materialQuery.toLowerCase());
    return matchesProject && matchesMaterial;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ativa':
        return <span className="badge badge-success">Ativa</span>;
      case 'liberada':
        return <span className="badge badge-info">Liberada (Fim de Projeto)</span>;
      case 'cancelada':
        return <span className="badge badge-error">Cancelada</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="reserves-container">
      {/* SELETOR DE ABAS */}
      <div className="tab-header">
        <button 
          onClick={() => setActiveTab('ativas')} 
          className={`tab-btn ${activeTab === 'ativas' ? 'active' : ''}`}
        >
          <BookmarkCheck size={18} /> Reservas Ativas
        </button>
        <button 
          onClick={() => setActiveTab('historico')} 
          className={`tab-btn ${activeTab === 'historico' ? 'active' : ''}`}
        >
          <History size={18} /> Histórico de Alocações
        </button>
      </div>

      {/* FILTROS CARD */}
      <div className="filter-card" style={{ marginTop: 0 }}>
        <div className="filter-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-group">
            <label className="form-label">Filtrar por Projeto (Código/Nome)</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ex: PROJ-2026-001" 
              value={projectQuery}
              onChange={(e) => setProjectQuery(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Filtrar por Material (Código/Descrição)</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ex: ACE-123" 
              value={materialQuery}
              onChange={(e) => setMaterialQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="login-alert alert-error">{error}</div>}

      {/* TABELA DE RESERVAS */}
      {loading ? (
        <div className="loading-state">Consultando alocações registradas...</div>
      ) : filteredReserves.length > 0 ? (
        <div className="table-container">
          <table className="erp-table mobile-cards-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Projeto</th>
                <th>Código Material</th>
                <th>Descrição Material</th>
                <th style={{ textAlign: 'right' }}>Qtd Reservada</th>
                <th>Status</th>
                <th>Operador</th>
                {activeTab === 'historico' && <th>Data Liberação / Cancelamento</th>}
                {activeTab === 'historico' && <th>Motivo Cancelamento</th>}
                {activeTab === 'ativas' && <th style={{ textAlign: 'center' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredReserves.map((res) => (
                <tr key={res.id}>
                  <td data-label="Data" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(res.reservado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td data-label="Projeto" className="tech-code">
                    {res.projeto_codigo} <span className="text-muted" style={{ fontWeight: 400 }}>({res.projeto_nome})</span>
                  </td>
                  <td data-label="Código Material" className="tech-code">{res.material_codigo}</td>
                  <td data-label="Descrição Material" className="desc-cell" title={res.material_descricao}>{res.material_descricao}</td>
                  <td data-label="Qtd Reservada" className="tech-number">
                    {res.quantidade_reservada.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} {res.material_unidade}
                  </td>
                  <td data-label="Status">{getStatusBadge(res.status)}</td>
                  <td data-label="Operador" style={{ fontWeight: 500 }}>{res.reservado_por_name}</td>
                  {activeTab === 'historico' && (
                    <td data-label="Data Liberação">
                      {res.liberado_em ? new Date(res.liberado_em).toLocaleString('pt-BR') : '-'}
                    </td>
                  )}
                  {activeTab === 'historico' && (
                    <td data-label="Motivo Cancelamento" className="text-truncated" title={res.motivo_cancelamento || ''}>
                      {res.motivo_cancelamento || '-'}
                    </td>
                  )}
                  {activeTab === 'ativas' && (
                    <td data-label="Ações" style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => handleCancelClick(res)} 
                        className="btn btn-danger btn-xs"
                      >
                        Cancelar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">Nenhuma reserva encontrada.</div>
      )}

      {/* MODAL: CANCELAR RESERVA */}
      {cancelModalOpen && selectedReserve && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Solicitar Cancelamento de Alocação</h3>
              <button onClick={() => setCancelModalOpen(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleCancelSubmit}>
              <div className="modal-body">
                {cancelError && <div className="login-alert alert-error">{cancelError}</div>}

                <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Você está liberando o estoque de <strong>{selectedReserve.quantidade_reservada.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} {selectedReserve.material_unidade}</strong> do material <strong>{selectedReserve.material_codigo}</strong> para o projeto <strong>{selectedReserve.projeto_codigo}</strong>.
                </p>

                <div className="form-group">
                  <label className="form-label">Justificativa de Cancelamento *</label>
                  <textarea 
                    className="form-control" 
                    rows="3" 
                    placeholder="Ex: Redução de escopo técnico, alteração de matéria-prima, cancelamento de transformador pelo cliente..." 
                    value={cancelReason} 
                    onChange={(e) => setCancelReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setCancelModalOpen(false)} className="btn btn-outline">Voltar</button>
                <button type="submit" className="btn btn-danger">Confirmar Cancelamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
