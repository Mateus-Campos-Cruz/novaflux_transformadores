import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Filter,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Tag,
  Hash
} from 'lucide-react';
import './Movimentacoes.css';

const TIPO_CONFIG = {
  entrada: {
    label: 'Entrada',
    icon: ArrowDownCircle,
    className: 'tipo-entrada'
  },
  saida: {
    label: 'Saída',
    icon: ArrowUpCircle,
    className: 'tipo-saida'
  },
  ajuste: {
    label: 'Ajuste',
    icon: RefreshCw,
    className: 'tipo-ajuste'
  }
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatQtd = (n) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n);

export const Movimentacoes = () => {
  // ── Filtros ──────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    data_inicio: '',
    data_fim: '',
    grupo: '',
    codigo: '',
    tipo: ''
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // ── Dados ─────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 50 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Grupos disponíveis para o select ──────────────────────────────────────
  const [grupos, setGrupos] = useState([]);

  // ── Busca ─────────────────────────────────────────────────────────────────
  const fetchMovimentacoes = useCallback(async (currentFilters, page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      Object.entries(currentFilters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
      const data = await api.get(`/movimentacoes?${params.toString()}`);
      setRows(data.movimentacoes || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Erro ao buscar movimentações.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar grupos únicos dos materiais para o select de grupo
  const fetchGrupos = useCallback(async () => {
    try {
      const data = await api.get('/materiais?limit=1000');
      const uniqueGrupos = [...new Set((data.materials || []).map(m => m.grupo).filter(Boolean))].sort();
      setGrupos(uniqueGrupos);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchMovimentacoes({});
    fetchGrupos();
  }, [fetchMovimentacoes, fetchGrupos]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    setAppliedFilters(active);
    setActiveFilterCount(Object.keys(active).length);
    fetchMovimentacoes(filters, 1);
  };

  const handleClearFilters = () => {
    const empty = { data_inicio: '', data_fim: '', grupo: '', codigo: '', tipo: '' };
    setFilters(empty);
    setAppliedFilters({});
    setActiveFilterCount(0);
    fetchMovimentacoes({}, 1);
  };

  const handlePageChange = (newPage) => {
    fetchMovimentacoes(appliedFilters, newPage);
  };

  // ── Totalizadores da página visível ───────────────────────────────────────
  const totais = rows.reduce(
    (acc, r) => {
      if (r.tipo === 'entrada') acc.entradas += r.quantidade;
      else if (r.tipo === 'saida') acc.saidas += r.quantidade;
      else acc.ajustes += r.quantidade;
      return acc;
    },
    { entradas: 0, saidas: 0, ajustes: 0 }
  );

  return (
    <div className="mov-page">
      {/* ── Filtros ─────────────────────────────────────────────── */}
      <div className="mov-filter-card">
        <div className="mov-filter-header">
          <div className="mov-filter-title">
            <Filter size={18} />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount} ativo{activeFilterCount > 1 ? 's' : ''}</span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button className="btn-clear-filters" onClick={handleClearFilters}>
              <X size={14} /> Limpar
            </button>
          )}
        </div>

        <form className="mov-filter-form" onSubmit={handleApplyFilters}>
          {/* Data */}
          <div className="filter-group">
            <label htmlFor="data_inicio">
              <Calendar size={14} /> Data Início
            </label>
            <input
              id="data_inicio"
              type="date"
              name="data_inicio"
              value={filters.data_inicio}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="data_fim">
              <Calendar size={14} /> Data Fim
            </label>
            <input
              id="data_fim"
              type="date"
              name="data_fim"
              value={filters.data_fim}
              onChange={handleFilterChange}
            />
          </div>

          {/* Código */}
          <div className="filter-group">
            <label htmlFor="codigo">
              <Hash size={14} /> Código
            </label>
            <input
              id="codigo"
              type="text"
              name="codigo"
              placeholder="Ex: TR-001"
              value={filters.codigo}
              onChange={handleFilterChange}
            />
          </div>

          {/* Grupo */}
          <div className="filter-group">
            <label htmlFor="grupo">
              <Tag size={14} /> Grupo
            </label>
            {grupos.length > 0 ? (
              <select id="grupo" name="grupo" value={filters.grupo} onChange={handleFilterChange}>
                <option value="">Todos os grupos</option>
                {grupos.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            ) : (
              <input
                id="grupo"
                type="text"
                name="grupo"
                placeholder="Ex: Transformadores"
                value={filters.grupo}
                onChange={handleFilterChange}
              />
            )}
          </div>

          {/* Tipo */}
          <div className="filter-group">
            <label htmlFor="tipo">
              <Activity size={14} /> Tipo
            </label>
            <select id="tipo" name="tipo" value={filters.tipo} onChange={handleFilterChange}>
              <option value="">Todos os tipos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>

          <button type="submit" className="btn-search" disabled={loading}>
            <Search size={16} />
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
      </div>

      {/* ── Totalizadores ───────────────────────────────────────── */}
      <div className="mov-stats">
        <div className="mov-stat-card stat-entradas">
          <TrendingDown size={22} />
          <div>
            <span className="stat-label">Entradas (página)</span>
            <span className="stat-value">{formatQtd(totais.entradas)}</span>
          </div>
        </div>
        <div className="mov-stat-card stat-saidas">
          <TrendingUp size={22} />
          <div>
            <span className="stat-label">Saídas (página)</span>
            <span className="stat-value">{formatQtd(totais.saidas)}</span>
          </div>
        </div>
        <div className="mov-stat-card stat-ajustes">
          <RefreshCw size={22} />
          <div>
            <span className="stat-label">Ajustes (página)</span>
            <span className="stat-value">{formatQtd(totais.ajustes)}</span>
          </div>
        </div>
        <div className="mov-stat-card stat-total">
          <Activity size={22} />
          <div>
            <span className="stat-label">Total de registros</span>
            <span className="stat-value">{pagination.totalItems}</span>
          </div>
        </div>
      </div>

      {/* ── Erro ────────────────────────────────────────────────── */}
      {error && (
        <div className="mov-error">
          <X size={16} /> {error}
        </div>
      )}

      {/* ── Tabela ──────────────────────────────────────────────── */}
      <div className="mov-table-card">
        {loading ? (
          <div className="mov-loading">
            <div className="spin-lg" />
            <span>Carregando movimentações...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="mov-empty">
            <Activity size={40} />
            <p>Nenhuma movimentação encontrada para os filtros aplicados.</p>
          </div>
        ) : (
          <div className="mov-table-wrapper">
            <table className="mov-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Data / Hora</th>
                  <th>Código</th>
                  <th>Grupo</th>
                  <th>Material</th>
                  <th>Unidade</th>
                  <th className="col-right">Quantidade</th>
                  <th>Motivo</th>
                  <th>Projeto</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cfg = TIPO_CONFIG[r.tipo] || TIPO_CONFIG.ajuste;
                  const Icon = cfg.icon;
                  return (
                    <tr key={r.id} className={`mov-row ${cfg.className}`}>
                      <td>
                        <span className={`tipo-badge ${cfg.className}`}>
                          <Icon size={13} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="col-date">{formatDate(r.realizado_em)}</td>
                      <td className="col-code">
                        <span className="code-chip">{r.material_codigo}</span>
                      </td>
                      <td className="col-grupo">{r.material_grupo}</td>
                      <td className="col-desc" title={r.material_descricao}>{r.material_descricao}</td>
                      <td className="col-unit">{r.material_unidade}</td>
                      <td className={`col-right col-qty ${cfg.className}-txt`}>
                        {r.tipo === 'entrada' ? '+' : r.tipo === 'saida' ? '−' : '~'}
                        {formatQtd(r.quantidade)}
                      </td>
                      <td className="col-motivo" title={r.motivo}>{r.motivo}</td>
                      <td className="col-proj">
                        {r.projeto_codigo
                          ? <span className="proj-chip">{r.projeto_codigo}</span>
                          : <span className="col-empty">—</span>}
                      </td>
                      <td className="col-user">{r.realizado_por}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Paginação ─────────────────────────────────────── */}
        {pagination.totalPages > 1 && (
          <div className="mov-pagination">
            <button
              className="pag-btn"
              disabled={pagination.currentPage === 1}
              onClick={() => handlePageChange(pagination.currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </button>

            <span className="pag-info">
              Página <strong>{pagination.currentPage}</strong> de <strong>{pagination.totalPages}</strong>
              &nbsp;·&nbsp; {pagination.totalItems} registros
            </span>

            <button
              className="pag-btn"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => handlePageChange(pagination.currentPage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
