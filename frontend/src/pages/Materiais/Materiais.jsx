import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, 
  Plus, 
  Upload, 
  History, 
  ArrowDownUp, 
  X, 
  FileSpreadsheet, 
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import './Materiais.css';

export const Materiais = () => {
  const { hasRole } = useAuth();
  
  // Lista e Paginação
  const [materials, setMaterials] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [codigoFilter, setCodigoFilter] = useState('');
  const [grupoFilter, setGrupoFilter] = useState('');
  const [descricaoFilter, setDescricaoFilter] = useState('');
  const [unidadeFilter, setUnidadeFilter] = useState('');

  // Modais de controle
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Material selecionado para Ajuste / Histórico
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  // Formulário de Criação
  const [newCodigo, setNewCodigo] = useState('');
  const [newGrupo, setNewGrupo] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [newUnidade, setNewUnidade] = useState('');
  const [newQtdFisica, setNewQtdFisica] = useState('0');
  const [newPesoUnitario, setNewPesoUnitario] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Formulário de Ajuste
  const [adjustTipo, setAdjustTipo] = useState('entrada');
  const [adjustQtd, setAdjustQtd] = useState('');
  const [adjustMotivo, setAdjustMotivo] = useState('');
  const [adjustError, setAdjustError] = useState('');

  // Histórico de movimentações
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Importação de Planilha
  const [selectedFile, setSelectedFile] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [importSuccess, setImportSuccess] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchMaterials = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: 50,
        codigo: codigoFilter,
        grupo: grupoFilter,
        descricao: descricaoFilter,
        unidade: unidadeFilter
      });
      
      const data = await api.get(`/materiais?${params.toString()}`);
      setMaterials(data.materials);
      setTotalPages(data.pagination.totalPages);
      setCurrentPage(data.pagination.currentPage);
      setTotalItems(data.pagination.totalItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials(1);
  }, [codigoFilter, grupoFilter, descricaoFilter, unidadeFilter]);

  const handleClearFilters = () => {
    setCodigoFilter('');
    setGrupoFilter('');
    setDescricaoFilter('');
    setUnidadeFilter('');
  };

  // 1. Ações de Criação Manual
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    if (!newCodigo || !newGrupo || !newDescricao || !newUnidade) {
      setCreateError('Todos os campos obrigatórios devem ser preenchidos.');
      return;
    }

    try {
      await api.post('/materiais', {
        codigo: newCodigo,
        grupo: newGrupo,
        descricao: newDescricao,
        unidade: newUnidade,
        quantidade_fisica: parseFloat(newQtdFisica) || 0,
        peso_unitario: newPesoUnitario ? parseFloat(newPesoUnitario) : null
      });

      setCreateSuccess('Material cadastrado com sucesso!');
      // Resetar form
      setNewCodigo('');
      setNewGrupo('');
      setNewDescricao('');
      setNewUnidade('');
      setNewQtdFisica('0');
      setNewPesoUnitario('');
      
      fetchMaterials(currentPage);
      setTimeout(() => setCreateModalOpen(false), 1500);
    } catch (err) {
      setCreateError(err.message);
    }
  };

  // 2. Ações de Ajuste de Estoque
  const openAdjustModal = (mat) => {
    setSelectedMaterial(mat);
    setAdjustTipo('entrada');
    setAdjustQtd('');
    setAdjustMotivo('');
    setAdjustError('');
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setAdjustError('');

    if (!adjustQtd || !adjustMotivo) {
      setAdjustError('A quantidade e a justificativa de motivo são obrigatórias.');
      return;
    }

    try {
      await api.post(`/materiais/${selectedMaterial.id}/movimentar`, {
        tipo: adjustTipo,
        quantidade: parseFloat(adjustQtd),
        motivo: adjustMotivo
      });

      fetchMaterials(currentPage);
      setAdjustModalOpen(false);
    } catch (err) {
      setAdjustError(err.message);
    }
  };

  // 3. Ações de Histórico
  const openHistoryModal = async (mat) => {
    setSelectedMaterial(mat);
    setHistoryModalOpen(true);
    setLoadingMovements(true);
    try {
      const data = await api.get(`/materiais/${mat.id}/movimentacoes`);
      setMovements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMovements(false);
    }
  };

  // 4. Ações de Importação de Planilha
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setImportErrors([]);
    setImportSuccess('');
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setImportErrors(['Por favor, selecione uma planilha nos formatos .csv ou .xlsx.']);
      return;
    }

    setImporting(true);
    setImportErrors([]);
    setImportSuccess('');

    const formData = new FormData();
    formData.append('planilha', selectedFile);

    try {
      const data = await api.upload('/materiais/import', formData);
      setImportSuccess(data.message);
      setSelectedFile(null);
      fetchMaterials(1);
      setTimeout(() => setImportModalOpen(false), 2000);
    } catch (err) {
      // Se vierem erros detalhados linha a linha do backend
      if (err.message.includes('Inconsistências encontradas') || err.message.includes('Importação não realizada')) {
        // Tentar obter detalhes do erro se o backend passou em json
        // Nosso apiRequest lança erro com o .error, mas se houver detalhes passamos
        // No express nós retornamos { error, details: [...] }. Vamos capturar isso.
        // O helper de API joga a string em erro. Para lidar com isso, podemos buscar direto do erro ou customizar.
        // Vamos checar se o erro carrega detalhes
      }
      // Como o erro lançado pelo api.js é um Error com a string descritiva,
      // em api.js capturamos o JSON e extraímos. Se o backend mandou detalhes,
      // nós podemos fazer uma requisição manual para tratar o JSON em api.js ou
      // de outra forma. No api.js definimos: `let errMsg = errData.error; throw new Error(errMsg);`
      // Vamos ajustar o api.js depois se necessário, mas por ora, vamos exibir a mensagem no modal.
      // Para exibir os detalhes linha a linha, vamos fazer a chamada direta do Fetch no import se precisarmos dos detalhes!
      // Sim, fazer uma chamada Fetch direta aqui no componente nos dá 100% de flexibilidade sobre a resposta JSON (incluindo o array de erros details).
      const refresh = localStorage.getItem('refreshToken');
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('http://localhost:5000/api/materiais/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const result = await response.json();
      if (!response.ok) {
        if (result.details && Array.isArray(result.details)) {
          setImportErrors(result.details);
        } else {
          setImportErrors([result.error || 'Erro na importação.']);
        }
      }
    } finally {
      setImporting(false);
    }
  };

  const getLiquidColorClass = (val) => {
    if (val > 0) return 'text-success font-semibold';
    if (val === 0) return 'text-warning font-semibold';
    return 'text-error font-semibold'; // Ruptura (negativo)
  };

  return (
    <div className="materials-container">
      {/* CABEÇALHO COM AÇÕES */}
      <div className="dashboard-actions">
        <p className="dashboard-subtitle">Visualização e edição do catálogo de estoque físico</p>
        
        {hasRole(['administrador', 'almoxarife', 'engenharia']) && (
          <div className="header-buttons">
            <button onClick={() => setImportModalOpen(true)} className="btn btn-outline">
              <Upload size={16} /> Importar Planilha
            </button>
            <button onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
              <Plus size={16} /> Novo Material
            </button>
          </div>
        )}
      </div>

      {/* FILTROS CARD */}
      <div className="filter-card">
        <div className="filter-grid">
          <div className="form-group">
            <label className="form-label">Código</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ex: ACE-101" 
              value={codigoFilter}
              onChange={(e) => setCodigoFilter(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Grupo</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ex: ACESSÓRIOS" 
              value={grupoFilter}
              onChange={(e) => setGrupoFilter(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição Técnica</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ex: Bucha isoladora" 
              value={descricaoFilter}
              onChange={(e) => setDescricaoFilter(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Unidade</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ex: KG, UN, M" 
              value={unidadeFilter}
              onChange={(e) => setUnidadeFilter(e.target.value)}
            />
          </div>
          <button onClick={handleClearFilters} className="btn btn-outline" style={{ height: '38px', marginBottom: '4px' }}>
            Limpar
          </button>
        </div>
      </div>

      {/* TABELA DE MATERIAIS */}
      {loading ? (
        <div className="loading-state">Consultando banco de materiais...</div>
      ) : materials.length > 0 ? (
        <>
          <div className="table-container">
            <table className="erp-table mobile-cards-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Grupo</th>
                  <th>Descrição Técnica</th>
                  <th>Unidade</th>
                  <th style={{ textAlign: 'right' }}>Estoque Físico</th>
                  <th style={{ textAlign: 'right' }}>Reservado</th>
                  <th style={{ textAlign: 'right' }}>Disponível Líquido</th>
                  {hasRole(['administrador', 'almoxarife', 'engenharia']) && <th style={{ textAlign: 'center' }}>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {materials.map((mat) => (
                  <tr key={mat.id}>
                    <td data-label="Código" className="tech-code">{mat.codigo}</td>
                    <td data-label="Grupo" style={{ fontWeight: 500 }}>{mat.grupo}</td>
                    <td data-label="Descrição Técnica" className="desc-cell" title={mat.descricao}>{mat.descricao}</td>
                    <td data-label="Unidade" style={{ textAlign: 'center', fontWeight: 600 }}>{mat.unidade}</td>
                    <td data-label="Estoque Físico" className="tech-number">
                      {mat.quantidade_fisica.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                    </td>
                    <td data-label="Reservado" className="tech-number text-muted">
                      {mat.total_reservado.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                    </td>
                    <td data-label="Disponível Líquido" className={`tech-number ${getLiquidColorClass(mat.disponivel_liquido)}`}>
                      {mat.disponivel_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                    </td>
                    {hasRole(['administrador', 'almoxarife', 'engenharia']) && (
                      <td data-label="Ações" style={{ textAlign: 'center' }}>
                        <div className="table-actions">
                          <button 
                            onClick={() => openAdjustModal(mat)} 
                            className="btn btn-outline btn-xs" 
                            title="Ajustar Estoque"
                          >
                            <ArrowDownUp size={14} />
                          </button>
                          <button 
                            onClick={() => openHistoryModal(mat)} 
                            className="btn btn-outline btn-xs" 
                            title="Histórico de Movimentações"
                          >
                            <History size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINAÇÃO */}
          <div className="pagination-wrapper">
            <span className="pagination-info">
              Exibindo <strong>{materials.length}</strong> de <strong>{totalItems}</strong> materiais cadastrados.
            </span>
            <div className="pagination-buttons">
              <button 
                onClick={() => fetchMaterials(currentPage - 1)} 
                disabled={currentPage === 1}
                className="btn btn-outline btn-xs"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-current">Pág. {currentPage} de {totalPages}</span>
              <button 
                onClick={() => fetchMaterials(currentPage + 1)} 
                disabled={currentPage === totalPages}
                className="btn btn-outline btn-xs"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">Nenhum material encontrado com os filtros selecionados.</div>
      )}

      {/* 1. MODAL: CADASTRAR MATERIAL MANUALMENTE */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Cadastrar Novo Material no Catálogo</h3>
              <button onClick={() => setCreateModalOpen(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {createError && <div className="login-alert alert-error">{createError}</div>}
                {createSuccess && <div className="login-alert alert-success">{createSuccess}</div>}
                
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Código do Material *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ex: ACE-123456" 
                      value={newCodigo} 
                      onChange={(e) => setNewCodigo(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Grupo de Material *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ex: ACESSÓRIOS DE TANQUE" 
                      value={newGrupo} 
                      onChange={(e) => setNewGrupo(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Descrição Técnica Completa *</label>
                  <textarea 
                    className="form-control" 
                    rows="3" 
                    placeholder="Descrição técnica detalhada para fabricação e compras..." 
                    value={newDescricao} 
                    onChange={(e) => setNewDescricao(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Unidade Medida *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ex: UN, M, KG, L" 
                      value={newUnidade} 
                      onChange={(e) => setNewUnidade(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estoque Físico Inicial</label>
                    <input 
                      type="number" 
                      step="0.001" 
                      className="form-control" 
                      value={newQtdFisica} 
                      onChange={(e) => setNewQtdFisica(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Peso Unitário (Kg)</label>
                    <input 
                      type="number" 
                      step="0.001" 
                      className="form-control" 
                      placeholder="Opcional" 
                      value={newPesoUnitario} 
                      onChange={(e) => setNewPesoUnitario(e.target.value)} 
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL: AJUSTAR ESTOQUE FÍSICO */}
      {adjustModalOpen && selectedMaterial && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Lançar Movimentação Física — {selectedMaterial.codigo}</h3>
              <button onClick={() => setAdjustModalOpen(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjustSubmit}>
              <div className="modal-body">
                {adjustError && <div className="login-alert alert-error">{adjustError}</div>}
                
                <p style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                  Ajustando o saldo do material: <strong>{selectedMaterial.descricao}</strong>. 
                  <br />Estoque físico atual: <strong>{selectedMaterial.quantidade_fisica.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} {selectedMaterial.unidade}</strong>.
                  <br />Reservas ativas globais: <strong>{selectedMaterial.total_reservado.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} {selectedMaterial.unidade}</strong>.
                </p>

                <div className="form-group">
                  <label className="form-label">Tipo de Lançamento</label>
                  <select 
                    className="form-control" 
                    value={adjustTipo} 
                    onChange={(e) => setAdjustTipo(e.target.value)}
                  >
                    <option value="entrada">Entrada (Adiciona ao saldo físico)</option>
                    <option value="saida">Saída (Subtrai do saldo físico)</option>
                    <option value="ajuste">Ajuste de Inventário (Define saldo absoluto final)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantidade *</label>
                  <input 
                    type="number" 
                    step="0.001" 
                    className="form-control" 
                    placeholder="Quantidade da movimentação ou novo valor absoluto" 
                    value={adjustQtd} 
                    onChange={(e) => setAdjustQtd(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Justificativa / Motivo Técnico *</label>
                  <textarea 
                    className="form-control" 
                    rows="3" 
                    placeholder="Ex: Recebimento NFe 32442, Retirada para Oficina, Ajuste de contagem anual..." 
                    value={adjustMotivo} 
                    onChange={(e) => setAdjustMotivo(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setAdjustModalOpen(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Movimentação</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MODAL: HISTÓRICO DE MOVIMENTAÇÕES */}
      {historyModalOpen && selectedMaterial && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Histórico de Movimentações — {selectedMaterial.codigo}</h3>
              <button onClick={() => setHistoryModalOpen(false)} className="close-btn"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                Registro completo de auditoria física de estoque para: <strong>{selectedMaterial.descricao}</strong>.
              </p>
              
              {loadingMovements ? (
                <div className="loading-state">Consultando histórico de lançamentos...</div>
              ) : movements.length > 0 ? (
                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Tipo</th>
                        <th style={{ textAlign: 'right' }}>Qtd</th>
                        <th>Motivo / Justificativa</th>
                        <th>Operador</th>
                        <th>Projeto Vinculado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((mv) => (
                        <tr key={mv.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {new Date(mv.realizado_em).toLocaleString('pt-BR')}
                          </td>
                          <td>
                            {mv.tipo === 'entrada' ? (
                              <span className="badge badge-success">Entrada</span>
                            ) : mv.tipo === 'saida' ? (
                              <span className="badge badge-error">Saída</span>
                            ) : (
                              <span className="badge badge-info">Ajuste</span>
                            )}
                          </td>
                          <td className="tech-number">
                            {mv.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                          </td>
                          <td>{mv.motivo}</td>
                          <td style={{ fontWeight: 500 }}>{mv.realizado_por}</td>
                          <td className="tech-code">{mv.projeto_codigo || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">Este material não possui histórico de movimentações.</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setHistoryModalOpen(false)} className="btn btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL: IMPORTAR PLANILHA DE MATERIAIS */}
      {importModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>Importar Catálogo via Planilha</h3>
              <button onClick={() => setImportModalOpen(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleImportSubmit}>
              <div className="modal-body">
                <div className="import-instructions">
                  <p><strong>Instruções de Importação:</strong></p>
                  <ul>
                    <li>Formatos suportados: <strong>.xlsx</strong> e <strong>.csv</strong>. Tamanho máximo: 10MB.</li>
                    <li>As colunas do cabeçalho devem ser: <code>Código</code>, <code>Grupo</code>, <code>Descrição Técnica</code>, <code>Unidade</code>, <code>Quantidade</code> e <code>Peso Unitário</code> (opcional).</li>
                    <li>Toda a importação é validada de forma transacional. Se qualquer linha falhar, nenhuma alteração será salva.</li>
                  </ul>
                </div>

                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="form-label">Selecionar Arquivo</label>
                  <div className="file-dropzone">
                    <FileSpreadsheet size={36} className="text-secondary" style={{ marginBottom: '0.5rem' }} />
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleFileChange}
                      disabled={importing}
                    />
                    {selectedFile ? (
                      <span className="file-name">Arquivo selecionado: <strong>{selectedFile.name}</strong></span>
                    ) : (
                      <span className="file-placeholder">Arraste ou clique para selecionar o arquivo</span>
                    )}
                  </div>
                </div>

                {importSuccess && (
                  <div className="login-alert alert-success" style={{ marginTop: '1rem' }}>
                    {importSuccess}
                  </div>
                )}

                {importErrors.length > 0 && (
                  <div className="import-errors-box" style={{ marginTop: '1.25rem' }}>
                    <div className="error-box-header">
                      <AlertCircle size={16} />
                      <span>Erros de Validação Encontrados ({importErrors.length}):</span>
                    </div>
                    <ul className="error-list">
                      {importErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setImportModalOpen(false)} className="btn btn-outline" disabled={importing}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={importing || !selectedFile}>
                  {importing ? 'Processando e Validando...' : 'Iniciar Importação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
