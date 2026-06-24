import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Play,
  Plus,
  Trash2,
  Search,
  AlertCircle,
  PackagePlus,
  Weight,
  Tag,
  Hash,
  Package
} from 'lucide-react';
import './ProjetoDetalhes.css';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n, d = 3) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const ProjetoDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modais existentes
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

  // Ações
  const [reserving, setReserving] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // ── MODAL INCLUIR PRODUTO ─────────────────────────────────────────────────
  const [addItemOpen, setAddItemOpen] = useState(false);

  // Busca de materiais no catálogo
  const [searchCodigo, setSearchCodigo] = useState('');
  const [searchDescricao, setSearchDescricao] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  // Item selecionado e quantidade
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState('');
  const [addItemSuccess, setAddItemSuccess] = useState('');

  // Removendo item
  const [removingId, setRemovingId] = useState(null);

  const searchDebounce = useRef(null);

  // ── Fetch Project ─────────────────────────────────────────────────────────
  const fetchProjectDetails = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  // ── Reserva em Lote ───────────────────────────────────────────────────────
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

  // ── Pendências ────────────────────────────────────────────────────────────
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

  // ── Importar Lista Técnica ────────────────────────────────────────────────
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setImportError('');
    setImportSuccess('');
  };

  const handleImportBOMSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) { setImportError('Selecione uma planilha válida.'); return; }
    setImporting(true);
    setImportError('');
    setImportSuccess('');
    const formData = new FormData();
    formData.append('planilha', selectedFile);
    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${BASE}/projetos/${id}/import-lista`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const result = await response.json();
      if (!response.ok) {
        setImportError(result.details?.join('\n') || result.error || 'Erro ao carregar lista técnica.');
      } else {
        setImportSuccess(result.message);
        setSelectedFile(null);
        fetchProjectDetails();
        setTimeout(() => setImportBOMOpen(false), 1500);
      }
    } catch {
      setImportError('Erro ao importar lista técnica.');
    } finally {
      setImporting(false);
    }
  };

  // ── Exportar CSV ──────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (pendencias.length === 0) return;
    const headers = ['Código', 'Grupo', 'Descrição Técnica', 'Unidade', 'Qtd Necessária', 'Qtd Reservada', 'Qtd em Falta'];
    const rows = pendencias.map(p => [
      p.codigo, p.grupo, `"${p.descricao.replace(/"/g, '""')}"`,
      p.unidade, p.quantidade_necessaria.toFixed(3), p.quantidade_reservada.toFixed(3), p.quantidade_falta.toFixed(3)
    ]);
    const csv = "\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Pendencias_${project.codigo_projeto}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ── Status ────────────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    try {
      await api.put(`/projetos/${id}`, { nome: project.nome, descricao: project.descricao, status: newStatus });
      fetchProjectDetails();
    } catch (err) {
      alert(`Erro ao alterar status: ${err.message}`);
    }
  };

  // ── MODAL INCLUIR PRODUTO — Busca de materiais ─────────────────────────────
  const handleOpenAddItem = () => {
    setAddItemOpen(true);
    setSearchCodigo('');
    setSearchDescricao('');
    setSearchResults([]);
    setSearchDone(false);
    setSelectedMaterial(null);
    setQuantidade('');
    setAddItemError('');
    setAddItemSuccess('');
  };

  const handleCloseAddItem = () => {
    setAddItemOpen(false);
    setSelectedMaterial(null);
    setQuantidade('');
    setAddItemError('');
    setAddItemSuccess('');
  };

  const runSearch = useCallback(async (codigo, descricao) => {
    if (!codigo && !descricao) { setSearchResults([]); setSearchDone(false); return; }
    setSearchLoading(true);
    setSearchDone(false);
    try {
      const params = new URLSearchParams({ limit: 20 });
      if (codigo) params.append('codigo', codigo);
      if (descricao) params.append('descricao', descricao);
      const data = await api.get(`/materiais?${params}`);
      setSearchResults(data.materials || []);
      setSearchDone(true);
    } catch {
      setSearchResults([]);
      setSearchDone(true);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounce automático ao digitar
  const handleSearchInput = (field, value) => {
    if (field === 'codigo') setSearchCodigo(value);
    else setSearchDescricao(value);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      const c = field === 'codigo' ? value : searchCodigo;
      const d = field === 'descricao' ? value : searchDescricao;
      runSearch(c, d);
    }, 350);
  };

  const handleSelectMaterial = (mat) => {
    setSelectedMaterial(mat);
    setQuantidade('');
    setAddItemError('');
  };

  const handleDeselectMaterial = () => {
    setSelectedMaterial(null);
    setQuantidade('');
    setAddItemError('');
  };

  // Aviso de estoque insuficiente
  const qtdNum = parseFloat(quantidade) || 0;
  const estoqueDisponivel = selectedMaterial?.disponivel_liquido ?? 0;
  const estoqueInsuficiente = qtdNum > 0 && qtdNum > estoqueDisponivel;

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!selectedMaterial) { setAddItemError('Selecione um material.'); return; }
    if (!quantidade || qtdNum <= 0) { setAddItemError('Informe uma quantidade válida (> 0).'); return; }

    setAddingItem(true);
    setAddItemError('');
    setAddItemSuccess('');
    try {
      await api.post(`/projetos/${id}/lista-materiais`, {
        material_id: selectedMaterial.id,
        quantidade_necessaria: qtdNum
      });
      setAddItemSuccess(`✓ ${selectedMaterial.codigo} adicionado à lista técnica!`);
      fetchProjectDetails();
      // Resetar seleção para adicionar mais itens
      setTimeout(() => {
        setSelectedMaterial(null);
        setQuantidade('');
        setAddItemSuccess('');
        setSearchResults([]);
        setSearchCodigo('');
        setSearchDescricao('');
        setSearchDone(false);
      }, 1200);
    } catch (err) {
      setAddItemError(err.message);
    } finally {
      setAddingItem(false);
    }
  };

  // ── Remover item da lista ─────────────────────────────────────────────────
  const handleRemoveItem = async (listaItemId, codigo) => {
    if (!window.confirm(`Remover "${codigo}" da lista técnica deste projeto?`)) return;
    setRemovingId(listaItemId);
    try {
      await api.delete(`/projetos/${id}/lista-materiais/${listaItemId}`);
      fetchProjectDetails();
    } catch (err) {
      alert(`Erro ao remover: ${err.message}`);
    } finally {
      setRemovingId(null);
    }
  };

  // ── Badges ────────────────────────────────────────────────────────────────
  const getStatusBadge = (status) => {
    switch (status) {
      case 'planejamento':    return <span className="badge badge-warning"><Clock size={12} style={{ marginRight: '4px' }} /> Planejamento</span>;
      case 'reserva_ativa':  return <span className="badge badge-info"><CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Reserva Ativa</span>;
      case 'em_producao':    return <span className="badge badge-success"><Play size={12} style={{ marginRight: '4px' }} /> Em Produção</span>;
      case 'encerrado':      return <span className="badge badge-secondary"><CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Encerrado</span>;
      default:               return <span className="badge">{status}</span>;
    }
  };

  const getItemStatusBadge = (status) => {
    switch (status) {
      case 'disponivel': return <span className="badge badge-success">OK (Disponível)</span>;
      case 'alerta':     return <span className="badge badge-warning">Aguardando Reserva</span>;
      case 'ruptura':    return <span className="badge badge-error">Ruptura</span>;
      default:           return <span className="badge">{status}</span>;
    }
  };

  const canEdit = hasRole(['administrador', 'engenharia', 'almoxarife']) && project?.status !== 'encerrado';

  if (loading && !project) {
    return <div className="loading-state">Carregando especificações do projeto...</div>;
  }
  if (error) {
    return <div className="login-alert alert-error">{error}</div>;
  }

  const temRuptura = materials.some(m => m.status === 'ruptura');

  return (
    <div className="project-detail-container">
      {/* IMPRESSÃO */}
      <div className="print-only-container">
        <h2>NOVAFLUX TRANSFORMADORES</h2>
        <h3>RELATÓRIO DE PENDÊNCIAS E RUPTURAS DE ESTOQUE</h3>
        <p><strong>Projeto:</strong> {project?.codigo_projeto} - {project?.nome}</p>
        <p><strong>Gerado em:</strong> {new Date().toLocaleString('pt-BR')}</p>
        <hr style={{ margin: '1rem 0' }} />
        <table className="erp-table">
          <thead><tr><th>Código</th><th>Descrição Técnica</th><th>Unidade</th><th>Qtd Necessária</th><th>Qtd Reservada</th><th>Falta comprar</th></tr></thead>
          <tbody>
            {pendencias.map(p => (
              <tr key={p.codigo}>
                <td>{p.codigo}</td><td>{p.descricao}</td><td>{p.unidade}</td>
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
            {canEdit && (
              <>
                {/* ★ NOVO botão Incluir Produto */}
                <button onClick={handleOpenAddItem} className="btn btn-primary">
                  <PackagePlus size={16} /> Incluir Produto
                </button>

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
                <button onClick={() => handleStatusChange('encerrado')} className="btn btn-danger">
                  Encerrar Projeto
                </button>
              </>
            )}

            {hasRole(['administrador', 'almoxarife', 'engenharia']) &&
             ['reserva_ativa', 'em_producao'].includes(project?.status) && (
              <button onClick={handleReserveBatch} className="btn btn-primary" disabled={reserving}>
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
          <h3><Layers size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />Lista Técnica de Materiais (BOM)</h3>
          <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{materials.length} item(ns)</span>
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
                  <th style={{ textAlign: 'right' }}>Disponível Livre</th>
                  <th style={{ textAlign: 'center' }}>Alocação</th>
                  {canEdit && <th style={{ textAlign: 'center' }}>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {materials.map((mat) => (
                  <tr key={mat.lista_item_id} className={mat.status === 'ruptura' ? 'row-ruptura' : ''}>
                    <td data-label="Código" className="tech-code">{mat.codigo}</td>
                    <td data-label="Grupo">{mat.grupo}</td>
                    <td data-label="Descrição Técnica" className="desc-cell" title={mat.descricao}>{mat.descricao}</td>
                    <td data-label="Unidade" style={{ textAlign: 'center', fontWeight: 600 }}>{mat.unidade}</td>
                    <td data-label="Qtd Necessária" className="tech-number">{fmt(mat.quantidade_necessaria)}</td>
                    <td data-label="Qtd Reservada" className="tech-number">{fmt(mat.quantidade_reservada)}</td>
                    <td data-label="Disponível Livre" className="tech-number">{fmt(Math.max(0, mat.disponivel_liquido))}</td>
                    <td data-label="Alocação" style={{ textAlign: 'center' }}>{getItemStatusBadge(mat.status)}</td>
                    {canEdit && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-remove-item"
                          title="Remover da lista técnica"
                          disabled={removingId === mat.lista_item_id}
                          onClick={() => handleRemoveItem(mat.lista_item_id, mat.codigo)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ margin: '1.5rem' }}>
              Nenhum material na lista técnica deste projeto.
              {canEdit && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  Use <strong>Incluir Produto</strong> para adicionar item a item, ou <strong>Importar Lista Técnica</strong> para subir uma planilha.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: INCLUIR PRODUTO
      ════════════════════════════════════════════════════════════════════ */}
      {addItemOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseAddItem()}>
          <div className="modal-content add-item-modal">
            <div className="modal-header">
              <h3><PackagePlus size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />Incluir Produto na Lista Técnica</h3>
              <button onClick={handleCloseAddItem} className="close-btn"><X size={20} /></button>
            </div>

            <div className="modal-body">
              {/* ── Área de busca ─────────────────────────────────── */}
              {!selectedMaterial ? (
                <>
                  <p className="add-item-hint">Pesquise pelo <strong>código</strong> ou <strong>descrição</strong> do material no catálogo:</p>

                  <div className="add-item-search-row">
                    <div className="add-item-search-field">
                      <label><Hash size={13} /> Código do Material</label>
                      <div className="search-input-wrap">
                        <Search size={15} className="search-icon" />
                        <input
                          type="text"
                          placeholder="Ex: TR-001"
                          value={searchCodigo}
                          onChange={e => handleSearchInput('codigo', e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="add-item-search-field flex-2">
                      <label><Search size={13} /> Descrição</label>
                      <div className="search-input-wrap">
                        <Search size={15} className="search-icon" />
                        <input
                          type="text"
                          placeholder="Ex: Núcleo de silício laminado"
                          value={searchDescricao}
                          onChange={e => handleSearchInput('descricao', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resultados */}
                  <div className="search-results-area">
                    {searchLoading && (
                      <div className="search-loading">
                        <div className="spin-sm" /> Buscando materiais...
                      </div>
                    )}

                    {!searchLoading && searchDone && searchResults.length === 0 && (
                      <div className="search-empty">
                        <Package size={28} />
                        <span>Nenhum material encontrado para os termos informados.</span>
                      </div>
                    )}

                    {!searchLoading && searchResults.length > 0 && (
                      <table className="search-results-table">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Grupo</th>
                            <th>Descrição Técnica</th>
                            <th>Un.</th>
                            <th style={{ textAlign: 'right' }}>Estoque Disp.</th>
                            <th style={{ textAlign: 'right' }}>Peso Un. (kg)</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchResults.map(mat => {
                            const jaNaLista = materials.some(m => m.material_id === mat.id);
                            return (
                              <tr key={mat.id} className={jaNaLista ? 'row-already-added' : ''}>
                                <td className="tech-code">{mat.codigo}</td>
                                <td><span className="group-chip">{mat.grupo}</span></td>
                                <td className="desc-cell" title={mat.descricao}>{mat.descricao}</td>
                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{mat.unidade}</td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                                    className={mat.disponivel_liquido <= 0 ? 'text-error' : mat.disponivel_liquido < 5 ? 'text-warning' : ''}>
                                  {fmt(mat.disponivel_liquido)}
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {mat.peso_unitario != null ? fmt(mat.peso_unitario) : '—'}
                                </td>
                                <td>
                                  {jaNaLista ? (
                                    <span className="badge badge-secondary" style={{ fontSize: '.68rem' }}>Já na lista</span>
                                  ) : (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleSelectMaterial(mat)}
                                    >
                                      <Plus size={13} /> Selecionar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {!searchLoading && !searchDone && (
                      <div className="search-empty">
                        <Search size={28} />
                        <span>Digite um código ou descrição para pesquisar no catálogo.</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ── Material selecionado: informar quantidade ─────── */
                <form onSubmit={handleAddItem} className="add-item-form">
                  {/* Card do material selecionado */}
                  <div className="selected-material-card">
                    <div className="selected-material-info">
                      <span className="sel-code">{selectedMaterial.codigo}</span>
                      <span className="sel-desc">{selectedMaterial.descricao}</span>
                    </div>
                    <div className="selected-material-meta">
                      <span><Tag size={13} /> {selectedMaterial.grupo}</span>
                      <span><Package size={13} /> {selectedMaterial.unidade}</span>
                      {selectedMaterial.peso_unitario != null && (
                        <span><Weight size={13} /> {fmt(selectedMaterial.peso_unitario)} kg/un</span>
                      )}
                    </div>
                    <div className="selected-material-stock">
                      <span className="stock-label">Estoque disponível:</span>
                      <span className={`stock-value ${estoqueDisponivel <= 0 ? 'text-error' : ''}`}>
                        {fmt(estoqueDisponivel)} {selectedMaterial.unidade}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-deselect"
                      onClick={handleDeselectMaterial}
                      title="Escolher outro material"
                    >
                      <X size={16} /> Trocar material
                    </button>
                  </div>

                  {/* Campo de quantidade */}
                  <div className="form-group qty-group">
                    <label className="form-label">
                      Quantidade Necessária <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="0,000"
                      value={quantidade}
                      onChange={e => setQuantidade(e.target.value)}
                      className={`form-input ${estoqueInsuficiente ? 'input-warning' : ''}`}
                      autoFocus
                      required
                    />
                    <span className="qty-unit">{selectedMaterial.unidade}</span>
                  </div>

                  {/* Aviso de estoque insuficiente */}
                  {estoqueInsuficiente && (
                    <div className="stock-warning-alert">
                      <AlertTriangle size={16} />
                      <span>
                        Quantidade necessária (<strong>{fmt(qtdNum)}</strong>) excede o estoque disponível
                        (<strong>{fmt(estoqueDisponivel)}</strong> {selectedMaterial.unidade}).
                        O item entrará em <strong>Ruptura</strong>.
                      </span>
                    </div>
                  )}

                  {addItemError && (
                    <div className="login-alert alert-error" style={{ marginTop: '.75rem' }}>
                      <AlertCircle size={15} /> {addItemError}
                    </div>
                  )}
                  {addItemSuccess && (
                    <div className="login-alert alert-success" style={{ marginTop: '.75rem' }}>
                      {addItemSuccess}
                    </div>
                  )}

                  <div className="modal-footer">
                    <button type="button" onClick={handleCloseAddItem} className="btn btn-outline">
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={addingItem || !quantidade}>
                      <Plus size={16} /> {addingItem ? 'Adicionando...' : 'Adicionar à Lista'}
                    </button>
                  </div>
                </form>
              )}

              {/* Erro e sucesso quando na tela de busca */}
              {!selectedMaterial && addItemError && (
                <div className="login-alert alert-error" style={{ marginTop: '.75rem' }}>
                  <AlertCircle size={15} /> {addItemError}
                </div>
              )}
            </div>

            {/* Footer quando na tela de busca */}
            {!selectedMaterial && (
              <div className="modal-footer">
                <button type="button" onClick={handleCloseAddItem} className="btn btn-outline">
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR LISTA TÉCNICA */}
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
                    <li>Todos os códigos já devem existir e estar ativos no catálogo geral.</li>
                  </ul>
                </div>
                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="form-label">Selecionar Planilha da Lista Técnica</label>
                  <div className="file-dropzone">
                    <FileSpreadsheet size={36} className="text-secondary" style={{ marginBottom: '0.5rem' }} />
                    <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} disabled={importing} />
                    {selectedFile
                      ? <span className="file-name">Arquivo: <strong>{selectedFile.name}</strong></span>
                      : <span className="file-placeholder">Clique ou arraste a planilha</span>}
                  </div>
                </div>
                {importSuccess && <div className="login-alert alert-success" style={{ marginTop: '1rem' }}>{importSuccess}</div>}
                {importError && (
                  <div className="import-errors-box" style={{ marginTop: '1rem' }}>
                    <div className="error-box-header"><AlertCircle size={16} /><span>Erros Encontrados:</span></div>
                    <pre className="error-text" style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: '#7A1C1C' }}>{importError}</pre>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setImportBOMOpen(false)} className="btn btn-outline" disabled={importing}>Cancelar</button>
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
                Abaixo estão os itens do projeto <strong>{project?.codigo_projeto}</strong> em <strong>Ruptura</strong>
                (quantidade faltante excede o estoque disponível).
              </p>
              {loadingPendencies ? (
                <div className="loading-state">Compilando faltas no banco...</div>
              ) : pendencias.length > 0 ? (
                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Código</th><th>Descrição Técnica</th><th>Unidade</th>
                        <th style={{ textAlign: 'right' }}>Qtd Requerida</th>
                        <th style={{ textAlign: 'right' }}>Qtd Reservada</th>
                        <th style={{ textAlign: 'right' }}>Disponível Líquido</th>
                        <th style={{ textAlign: 'right' }}>Quantidade em Falta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendencias.map(p => (
                        <tr key={p.codigo}>
                          <td className="tech-code">{p.codigo}</td>
                          <td className="desc-cell" title={p.descricao}>{p.descricao}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.unidade}</td>
                          <td className="tech-number">{fmt(p.quantidade_necessaria)}</td>
                          <td className="tech-number">{fmt(p.quantidade_reservada)}</td>
                          <td className="tech-number">{fmt(Math.max(0, p.disponivel_liquido))}</td>
                          <td className="tech-number text-error" style={{ fontWeight: 'bold' }}>{fmt(p.quantidade_falta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state" style={{ borderColor: 'var(--success)', color: 'var(--success)', background: 'var(--success-bg)' }}>
                  Excelente! Este projeto não possui pendências de estoque físico. Todos os materiais estão disponíveis ou já reservados.
                </div>
              )}
            </div>
            <div className="modal-footer">
              {pendencias.length > 0 && (
                <>
                  <button onClick={handleExportCSV} className="btn btn-outline"><Download size={16} /> Exportar CSV</button>
                  <button onClick={() => window.print()} className="btn btn-outline"><Printer size={16} /> Imprimir PDF</button>
                </>
              )}
              <button type="button" onClick={() => setPendencyOpen(false)} className="btn btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
