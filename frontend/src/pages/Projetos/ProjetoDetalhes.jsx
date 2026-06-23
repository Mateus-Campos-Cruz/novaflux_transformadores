import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  ArrowLeft, 
  Upload, 
  Layers, 
  Flame, 
  BookmarkCheck, 
  FileSpreadsheet, 
  AlertTriangle, 
  Download, 
  Printer, 
  X,
  Clock,
  CheckCircle2,
  Play
} from 'lucide-react';
import './ProjetoDetalhes.css';

export const ProjetoDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modais
  const [importBOMOpen, setImportBOMOpen] = useState(false);
  const [pendencyOpen, setPendencyOpen] = useState(false);

  // Importação BOM
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Relatório de pendências
  const [pendencias, setPendencias] = useState([]);
  const [loadingPendencies, setLoadingPendencies] = useState(false);

  // Status de Ações
  const [reserving, setReserving] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const fetchProjectDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/projetos/${id}`);
      setProject(data.projeto);
      setMaterials(data.materials);
    } catch (err) {
      setError(err.message || 'Erro ao carregar detalhes do projeto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  // Lote de reservas
  const handleReserveBatch = async () => {
    if (reserving) return;
    setReserving(true);
    setActionMsg('');
    try {
      const result = await api.post(`/projetos/${id}/reservar-lote`);
      setActionMsg(result.message);
      fetchProjectDetails();
    } catch (err) {
      setActionMsg(`Erro: ${err.message}`);
    } finally {
      setReserving(false);
    }
  };

  // Carregar Relatório de Pendências
  const handleOpenPendencies = async () => {
    setPendencyOpen(true);
    setLoadingPendencies(true);
    try {
      const data = await api.get(`/projetos/${id}/pendencias`);
      setPendencias(data.pendencias);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPendencies(false);
    }
  };

  // Importar Lista Técnica
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setImportError('');
    setImportSuccess('');
  };

  const handleImportBOMSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setImportError('Selecione uma planilha válida.');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportSuccess('');

    const formData = new FormData();
    formData.append('planilha', selectedFile);

    try {
      // Usar a chamada fetch direta caso precisemos obter o JSON de erros detalhados
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5000/api/projetos/${id}/import-lista`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.details && Array.isArray(result.details)) {
          setImportError(result.details.join('\n'));
        } else {
          setImportError(result.error || 'Erro ao carregar lista técnica.');
        }
      } else {
        setImportSuccess(result.message);
        setSelectedFile(null);
        fetchProjectDetails();
        setTimeout(() => setImportBOMOpen(false), 1500);
      }
    } catch (err) {
      setImportError('Erro ao importar lista técnica.');
    } finally {
      setImporting(false);
    }
  };

  // Exportar Pendências para CSV
  const handleExportCSV = () => {
    if (pendencias.length === 0) return;
    
    const headers = ['Código', 'Grupo', 'Descrição Técnica', 'Unidade', 'Qtd Necessária', 'Qtd Reservada', 'Qtd em Falta'];
    const rows = pendencias.map(p => [
      p.codigo,
      p.grupo,
      `"${p.descricao.replace(/"/g, '""')}"`, // escape quotes for CSV
      p.unidade,
      p.quantidade_necessaria.toFixed(3),
      p.quantidade_reservada.toFixed(3),
      p.quantidade_falta.toFixed(3)
    ]);

    // Usar separador ponto e vírgula e BOM UTF-8 para Excel aceitar acentuação
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Pendencias_${project.codigo_projeto}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Imprimir Relatório de Pendências como PDF
  const handlePrintPDF = () => {
    window.print();
  };

  // Atualizar Status do Projeto (Encerramento ou Produção)
  const handleStatusChange = async (newStatus) => {
    try {
      await api.put(`/projetos/${id}`, {
        nome: project.nome,
        descricao: project.descricao,
        status: newStatus
      });
      fetchProjectDetails();
    } catch (err) {
      alert(`Erro ao alterar status: ${err.message}`);
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

  const getItemStatusBadge = (status) => {
    switch (status) {
      case 'disponivel':
        return <span className="badge badge-success">OK (Disponível)</span>;
      case 'alerta':
        return <span className="badge badge-warning">Aguardando Reserva</span>;
      case 'ruptura':
        return <span className="badge badge-error">Ruptura</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  if (loading && !project) {
    return <div className="loading-state">Carregando especificações do projeto...</div>;
  }

  if (error) {
    return <div className="login-alert alert-error">{error}</div>;
  }

  // Verifica se há alguma ruptura
  const temRuptura = materials.some(m => m.status === 'ruptura');

  return (
    <div className="project-detail-container">
      {/* IMPRESSÃO PENDENCIAS (ESCONDIDA NA TELA NORMAL) */}
      <div className="print-only-container">
        <h2>NOVAFLUX TRANSFORMADORES</h2>
        <h3>RELATÓRIO DE PENDÊNCIAS E RUPTURAS DE ESTOQUE</h3>
        <p><strong>Projeto:</strong> {project?.codigo_projeto} - {project?.nome}</p>
        <p><strong>Gerado em:</strong> {new Date().toLocaleString('pt-BR')}</p>
        <hr style={{ margin: '1rem 0' }} />
        <table className="erp-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição Técnica</th>
              <th>Unidade</th>
              <th>Qtd Necessária</th>
              <th>Qtd Reservada</th>
              <th>Falta comprar</th>
            </tr>
          </thead>
          <tbody>
            {pendencias.map(p => (
              <tr key={p.codigo}>
                <td>{p.codigo}</td>
                <td>{p.descricao}</td>
                <td>{p.unidade}</td>
                <td>{p.quantidade_necessaria.toFixed(3)}</td>
                <td>{p.quantidade_reservada.toFixed(3)}</td>
                <td style={{ fontWeight: 'bold', color: 'red' }}>{p.quantidade_falta.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TELA NORMAL */}
      <div className="back-link" onClick={() => navigate('/projetos')}>
        <ArrowLeft size={16} /> Voltar para Projetos
      </div>

      <div className="project-header-panel">
        <div className="header-meta-row">
          <div className="proj-info-block">
            <span className="proj-code-large">{project?.codigo_projeto}</span>
            <h2>{project?.nome}</h2>
            <p className="proj-desc-large">{project?.descricao || 'Sem descrição cadastrada.'}</p>
          </div>
          <div className="proj-status-block">
            {getStatusBadge(project?.status)}
            {temRuptura && (
              <span className="badge badge-error animate-pulse" style={{ marginTop: '0.5rem' }}>
                <Flame size={12} style={{ marginRight: '4px' }} /> Ruptura Identificada
              </span>
            )}
          </div>
        </div>

        <div className="header-actions-row">
          <div className="meta-info">
            <span>Criado por: <strong>{project?.criado_por_nome || 'N/A'}</strong></span>
            <span>Data de cadastro: <strong>{new Date(project?.criado_em).toLocaleDateString('pt-BR')}</strong></span>
          </div>

          <div className="action-buttons">
            {hasRole(['administrador', 'engenharia']) && project?.status !== 'encerrado' && (
              <>
                <button onClick={() => setImportBOMOpen(true)} className="btn btn-outline">
                  <Upload size={16} /> Importar Lista Técnica
                </button>
                {project?.status === 'planejamento' && (
                  <button onClick={() => handleStatusChange('reserva_ativa')} className="btn btn-secondary">
                    Iniciar Fase de Reserva
                  </button>
                )}
                {project?.status === 'reserva_ativa' && (
                  <button onClick={() => handleStatusChange('em_producao')} className="btn btn-secondary">
                    Liberar para Produção
                  </button>
                )}
                {project?.status !== 'encerrado' && (
                  <button onClick={() => handleStatusChange('encerrado')} className="btn btn-danger">
                    Encerrar Projeto
                  </button>
                )}
              </>
            )}

            {hasRole(['administrador', 'almoxarife', 'engenharia']) && 
             ['reserva_ativa', 'em_producao'].includes(project?.status) && (
              <button 
                onClick={handleReserveBatch} 
                className="btn btn-primary"
                disabled={reserving}
              >
                <BookmarkCheck size={16} /> {reserving ? 'Reservando...' : 'Reservar em Lote'}
              </button>
            )}

            <button onClick={handleOpenPendencies} className="btn btn-accent">
              <AlertTriangle size={16} /> Relatório de Pendências
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className={`action-alert ${actionMsg.includes('Erro') ? 'alert-error' : 'alert-success'}`}>
            {actionMsg}
          </div>
        )}
      </div>

      {/* LISTA DE MATERIAIS */}
      <div className="card-panel">
        <div className="panel-header">
          <h3>Lista Técnica de Materiais (BOM)</h3>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {materials.length > 0 ? (
            <table className="erp-table mobile-cards-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Grupo</th>
                  <th>Descrição Técnica</th>
                  <th>Unidade</th>
                  <th style={{ textAlign: 'right' }}>Qtd Necessária</th>
                  <th style={{ textAlign: 'right' }}>Qtd Reservada</th>
                  <th style={{ textAlign: 'right' }}>Disponível Livre (Almoxarifado)</th>
                  <th style={{ textAlign: 'center' }}>Alocação</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((mat) => (
                  <tr key={mat.lista_item_id} className={mat.status === 'ruptura' ? 'row-ruptura' : ''}>
                    <td data-label="Código" className="tech-code">{mat.codigo}</td>
                    <td data-label="Grupo">{mat.grupo}</td>
                    <td data-label="Descrição Técnica" className="desc-cell" title={mat.descricao}>{mat.descricao}</td>
                    <td data-label="Unidade" style={{ textAlign: 'center', fontWeight: 600 }}>{mat.unidade}</td>
                    <td data-label="Qtd Necessária" className="tech-number">
                      {mat.quantidade_necessaria.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                    </td>
                    <td data-label="Qtd Reservada" className="tech-number">
                      {mat.quantidade_reservada.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                    </td>
                    <td data-label="Disponível Livre" className="tech-number">
                      {Math.max(0, mat.disponivel_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                    </td>
                    <td data-label="Alocação" style={{ textAlign: 'center' }}>
                      {getItemStatusBadge(mat.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ margin: '1.5rem' }}>
              Nenhum material importado para a lista técnica deste projeto.
              {hasRole(['administrador', 'engenharia']) && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  Use o botão <strong>Importar Lista Técnica</strong> para subir a planilha de requisitos.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: IMPORTAR LISTA TÉCNICA (BOM) */}
      {importBOMOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Importar Requisitos (BOM) do Projeto</h3>
              <button onClick={() => setImportBOMOpen(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleImportBOMSubmit}>
              <div className="modal-body">
                <div className="import-instructions">
                  <p><strong>Formato do Arquivo:</strong></p>
                  <ul>
                    <li>Extensões aceitas: <strong>.xlsx</strong> e <strong>.csv</strong>. Máximo: 10MB.</li>
                    <li>Deve conter exatamente as colunas: <code>Código</code> e <code>Quantidade</code>.</li>
                    <li>Todos os códigos de materiais informados já devem existir e estar ativos no catálogo geral.</li>
                  </ul>
                </div>

                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="form-label">Selecionar Planilha da Lista Técnica</label>
                  <div className="file-dropzone">
                    <FileSpreadsheet size={36} className="text-secondary" style={{ marginBottom: '0.5rem' }} />
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleFileChange}
                      disabled={importing}
                    />
                    {selectedFile ? (
                      <span className="file-name">Arquivo: <strong>{selectedFile.name}</strong></span>
                    ) : (
                      <span className="file-placeholder">Clique ou arraste a planilha</span>
                    )}
                  </div>
                </div>

                {importSuccess && (
                  <div className="login-alert alert-success" style={{ marginTop: '1rem' }}>
                    {importSuccess}
                  </div>
                )}

                {importError && (
                  <div className="import-errors-box" style={{ marginTop: '1rem' }}>
                    <div className="error-box-header">
                      <AlertCircle size={16} />
                      <span>Erros Encontrados:</span>
                    </div>
                    <pre className="error-text" style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: '#7A1C1C' }}>
                      {importError}
                    </pre>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setImportBOMOpen(false)} className="btn btn-outline" disabled={importing}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={importing || !selectedFile}>
                  {importing ? 'Processando...' : 'Carregar Itens'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RELATÓRIO DE PENDÊNCIAS */}
      {pendencyOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h3>Relatório de Pendências / Compras necessárias</h3>
              <button onClick={() => setPendencyOpen(false)} className="close-btn"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Abaixo estão listados apenas os itens do projeto <strong>{project?.codigo_projeto}</strong> que encontram-se em <strong>Ruptura</strong> (onde a quantidade que falta reservar excede o estoque disponível líquido do almoxarifado).
              </p>

              {loadingPendencies ? (
                <div className="loading-state">Compilando faltas no banco...</div>
              ) : pendencias.length > 0 ? (
                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Descrição Técnica</th>
                        <th>Unidade</th>
                        <th style={{ textAlign: 'right' }}>Qtd Requerida</th>
                        <th style={{ textAlign: 'right' }}>Qtd Reservada</th>
                        <th style={{ textAlign: 'right' }}>Disponível Líquido</th>
                        <th style={{ textAlign: 'right' }}>Quantidade em Falta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendencias.map((p) => (
                        <tr key={p.codigo}>
                          <td className="tech-code">{p.codigo}</td>
                          <td className="desc-cell" title={p.descricao}>{p.descricao}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.unidade}</td>
                          <td className="tech-number">
                            {p.quantidade_necessaria.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                          </td>
                          <td className="tech-number">
                            {p.quantidade_reservada.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                          </td>
                          <td className="tech-number">
                            {Math.max(0, p.disponivel_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                          </td>
                          <td className="tech-number text-error" style={{ fontWeight: 'bold' }}>
                            {p.quantidade_falta.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state" style={{ borderColor: 'var(--success)', color: 'var(--success)', background: 'var(--success-bg)' }}>
                  Excelente! Este projeto não possui pendências de estoque físico (rupturas). Todos os materiais estão completamente disponíveis ou já reservados.
                </div>
              )}
            </div>
            <div className="modal-footer">
              {pendencias.length > 0 && (
                <>
                  <button onClick={handleExportCSV} className="btn btn-outline">
                    <Download size={16} /> Exportar CSV
                  </button>
                  <button onClick={handlePrintPDF} className="btn btn-outline">
                    <Printer size={16} /> Imprimir PDF / Relatório
                  </button>
                </>
              )}
              <button type="button" onClick={() => setPendencyOpen(false)} className="btn btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
