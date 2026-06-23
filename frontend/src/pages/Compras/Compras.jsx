import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ShoppingCart, Download, ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react';
import './Compras.css';

export const Compras = () => {
  const [rupturas, setRupturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedMaterial, setExpandedMaterial] = useState(null);

  const fetchRupturas = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/compras/rupturas');
      setRupturas(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar lista de rupturas para compras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRupturas();
  }, []);

  const toggleExpand = (id) => {
    if (expandedMaterial === id) {
      setExpandedMaterial(null);
    } else {
      setExpandedMaterial(id);
    }
  };

  // Exportar lista de compras CSV
  const handleExportCSV = () => {
    if (rupturas.length === 0) return;

    const headers = ['Código', 'Descrição Técnica', 'Unidade', 'Quantidade Total para Compra'];
    const rows = rupturas.map(r => [
      r.codigo,
      `"${r.descricao.replace(/"/g, '""')}"`,
      r.unidade,
      r.quantidade_comprar.toFixed(3)
    ]);

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Lista_Compras_NovaFlux_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="compras-container">
      <div className="dashboard-actions">
        <p className="dashboard-subtitle">
          Painel central de planejamento de suprimentos — consolidação de rupturas em projetos ativos
        </p>
        {rupturas.length > 0 && (
          <button onClick={handleExportCSV} className="btn btn-primary">
            <Download size={16} /> Exportar Lista de Compras (CSV)
          </button>
        )}
      </div>

      {error && <div className="login-alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-state">Consolidando demandas em falta no almoxarifado...</div>
      ) : rupturas.length > 0 ? (
        <div className="card-panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Itens com Ruptura Consolidada</h3>
            <span className="badge badge-error">
              {rupturas.length} {rupturas.length === 1 ? 'material' : 'materiais'} em falta
            </span>
          </div>
          
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="erp-table erp-table-accordion">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Código</th>
                  <th>Descrição Técnica</th>
                  <th>Unidade</th>
                  <th style={{ textAlign: 'right' }}>Estoque Livre</th>
                  <th style={{ textAlign: 'right' }}>Total Demandado</th>
                  <th style={{ textAlign: 'right' }}>Necessidade Compra</th>
                </tr>
              </thead>
              <tbody>
                {rupturas.map((mat) => {
                  const isExpanded = expandedMaterial === mat.id;
                  return (
                    <React.Fragment key={mat.id}>
                      <tr 
                        className={`accordion-trigger-row ${isExpanded ? 'row-expanded' : ''}`}
                        onClick={() => toggleExpand(mat.id)}
                      >
                        <td style={{ textAlign: 'center' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td className="tech-code">{mat.codigo}</td>
                        <td className="desc-cell" title={mat.descricao}>{mat.descricao}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{mat.unidade}</td>
                        <td className="tech-number">
                          {Math.max(0, mat.disponivel_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                        </td>
                        <td className="tech-number">
                          {mat.total_pendente.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                        </td>
                        <td className="tech-number text-error" style={{ fontWeight: 'bold' }}>
                          {mat.quantidade_comprar.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="accordion-details-row">
                          <td colSpan="7">
                            <div className="accordion-details-box">
                              <div className="details-header">
                                <Info size={14} />
                                <span>Detalhamento da demanda deste item por projetos ativos:</span>
                              </div>
                              <table className="details-table">
                                <thead>
                                  <tr>
                                    <th>Código Projeto</th>
                                    <th>Nome do Projeto</th>
                                    <th style={{ textAlign: 'right' }}>Quantidade Necessária</th>
                                    <th style={{ textAlign: 'right' }}>Quantidade Reservada</th>
                                    <th style={{ textAlign: 'right' }}>Saldo Pendente</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mat.projetos.map((proj) => (
                                    <tr key={proj.projeto_id}>
                                      <td className="tech-code">{proj.codigo_projeto}</td>
                                      <td>{proj.projeto_name}</td>
                                      <td className="tech-number">
                                        {proj.quantidade_necessaria.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                                      </td>
                                      <td className="tech-number">
                                        {proj.quantidade_reservada.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                                      </td>
                                      <td className="tech-number text-warning" style={{ fontWeight: 600 }}>
                                        {proj.quantidade_pendente.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ borderColor: 'var(--success)', color: 'var(--success)', background: 'var(--success-bg)' }}>
          <AlertCircle size={32} style={{ marginBottom: '0.5rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
          Nenhuma ruptura ativa nos projetos! Todo o estoque necessário está coberto no almoxarifado.
        </div>
      )}
    </div>
  );
};
