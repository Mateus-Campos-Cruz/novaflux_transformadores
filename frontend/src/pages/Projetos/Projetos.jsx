import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, FolderKanban, Flame, Clock, Play, CheckCircle2, ChevronRight, X } from 'lucide-react';
import './Projetos.css';

export const Projetos = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form criação
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [newStatus, setNewStatus] = useState('planejamento');
  const [createError, setCreateError] = useState('');

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/projetos');
      setProjects(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar lista de projetos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!newCodigo || !newNome) {
      setCreateError('Código e Nome do Projeto são obrigatórios.');
      return;
    }

    try {
      await api.post('/projetos', {
        codigo_projeto: newCodigo,
        nome: newNome,
        descricao: newDescricao,
        status: newStatus
      });

      setCreateModalOpen(false);
      // Reset form
      setNewCodigo('');
      setNewNome('');
      setNewDescricao('');
      setNewStatus('planejamento');
      
      fetchProjects();
    } catch (err) {
      setCreateError(err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'planejamento':
        return <span className="badge badge-warning"><Clock size={12} style={{ marginRight: '4px' }} /> Planejamento</span>;
      case 'reserva_ativa':
        return <span className="badge badge-info"><CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Reserva Ativa</span>;
      case 'em_producao':
        return <span className="badge badge-success"><Play size={12} style={{ marginRight: '4px' }} /> Em Produção</span>;
      case 'encerrado':
        return <span className="badge badge-secondary"><CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Encerrado</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="projects-container">
      <div className="dashboard-actions">
        <p className="dashboard-subtitle">Acompanhamento de ordens de fabricação e alocação de insumos</p>
        
        {hasRole(['administrador', 'engenharia']) && (
          <button onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Novo Projeto
          </button>
        )}
      </div>

      {error && <div className="login-alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-state">Consultando banco de projetos...</div>
      ) : projects.length > 0 ? (
        <div className="projects-grid">
          {projects.map((proj) => (
            <div 
              key={proj.id} 
              className={`project-card ${proj.tem_ruptura ? 'card-ruptura-border' : ''}`}
              onClick={() => navigate(`/projetos/${proj.id}`)}
            >
              <div className="project-card-header">
                <span className="project-code">{proj.codigo_projeto}</span>
                {getStatusBadge(proj.status)}
              </div>
              
              <h3 className="project-title">{proj.nome}</h3>
              <p className="project-desc">{proj.descricao || 'Sem descrição técnica adicional.'}</p>
              
              <div className="project-card-footer">
                <div className="project-meta">
                  <span className="creator-label">Criado por:</span>
                  <span className="creator-name">{proj.criado_por_nome || 'N/A'}</span>
                </div>
                
                {proj.tem_ruptura ? (
                  <span className="badge badge-error animate-pulse">
                    <Flame size={12} style={{ marginRight: '4px' }} /> Ruptura
                  </span>
                ) : (
                  <span className="badge badge-success">Estoque OK</span>
                )}
              </div>
              
              <div className="card-overlay-btn">
                <span>Ver Detalhes</span>
                <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">Nenhum projeto cadastrado no sistema.</div>
      )}

      {/* MODAL: NOVO PROJETO */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Cadastrar Novo Projeto de Produção</h3>
              <button onClick={() => setCreateModalOpen(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {createError && <div className="login-alert alert-error">{createError}</div>}
                
                <div className="form-group">
                  <label className="form-label">Código do Projeto (Único) *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: PROJ-2026-001" 
                    value={newCodigo} 
                    onChange={(e) => setNewCodigo(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nome do Projeto / Cliente *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: Transformador Trifásico 500kVA - Vale S.A." 
                    value={newNome} 
                    onChange={(e) => setNewNome(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descrição / Especificações Técnicas</label>
                  <textarea 
                    className="form-control" 
                    rows="3" 
                    placeholder="Especificações de enrolamento, tensões, acessórios especiais..." 
                    value={newDescricao} 
                    onChange={(e) => setNewDescricao(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status Inicial</label>
                  <select 
                    className="form-control" 
                    value={newStatus} 
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value="planejamento">Planejamento</option>
                    <option value="reserva_ativa">Reserva Ativa</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar Projeto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
