import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  FolderKanban, 
  BookmarkCheck, 
  ShoppingCart, 
  ShieldAlert, 
  LogOut, 
  Menu, 
  X, 
  User,
  ArrowLeftRight
} from 'lucide-react';
import './Layout.css';

export const Layout = ({ children }) => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { 
      path: '/', 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      roles: ['administrador', 'almoxarife', 'engenharia', 'compras'] 
    },
    { 
      path: '/materiais', 
      label: 'Materiais', 
      icon: Package, 
      roles: ['administrador', 'almoxarife', 'engenharia', 'compras'] 
    },
    { 
      path: '/projetos', 
      label: 'Projetos', 
      icon: FolderKanban, 
      roles: ['administrador', 'almoxarife', 'engenharia', 'compras'] 
    },
    { 
      path: '/reservas', 
      label: 'Reservas', 
      icon: BookmarkCheck, 
      roles: ['administrador', 'almoxarife', 'engenharia'] // compras não acessa
    },
    { 
      path: '/movimentacoes', 
      label: 'Movimentações', 
      icon: ArrowLeftRight, 
      roles: ['administrador', 'almoxarife', 'engenharia', 'compras'] 
    },
    { 
      path: '/compras', 
      label: 'Área de Compras', 
      icon: ShoppingCart, 
      roles: ['administrador', 'compras', 'engenharia', 'almoxarife'] 
    },
    { 
      path: '/auditoria', 
      label: 'Auditoria', 
      icon: ShieldAlert, 
      roles: ['administrador'] // apenas admin
    }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const current = menuItems.find(item => item.path === location.pathname);
    if (current) return current.label;
    if (location.pathname.startsWith('/projetos/')) return 'Detalhes do Projeto';
    return 'NovaFlux';
  };

  return (
    <div className="app-container">
      {/* SIDEBAR DESKTOP E TABLET */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>NOVA<span>FLUX</span></h2>
          <small>ALMOXARIFADO</small>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems
            .filter(item => hasRole(item.roles))
            .map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">
              <User size={18} />
            </div>
            <div className="user-details">
              <span className="user-name" title={user?.nome}>{user?.nome}</span>
              <span className="user-role">{user?.perfil}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Sair do sistema">
            <LogOut size={18} />
            <span className="nav-label">Sair</span>
          </button>
        </div>
      </aside>

      {/* GAVETA RETRÁTIL MOBILE */}
      <div className={`mobile-drawer-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
      <aside className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="sidebar-brand">
            <h2>NOVA<span>FLUX</span></h2>
            <small>ALMOXARIFADO</small>
          </div>
          <button className="close-btn" onClick={() => setMobileOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="drawer-nav">
          {menuItems
            .filter(item => hasRole(item.roles))
            .map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={20} className="nav-icon" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="drawer-footer">
          <div className="user-profile">
            <div className="avatar">
              <User size={18} />
            </div>
            <div className="user-details">
              <span className="user-name">{user?.nome}</span>
              <span className="user-role">{user?.perfil}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="main-content">
        <header className="main-header">
          <button className="menu-toggle" onClick={() => setMobileOpen(true)}>
            <Menu size={24} />
          </button>
          
          <h1 className="header-title">{getPageTitle()}</h1>
          
          <div className="header-user-info">
            <span className="badge badge-info">{user?.perfil}</span>
            <div className="divider"></div>
            <span className="user-email">{user?.email}</span>
          </div>
        </header>
        
        <main className="page-container">
          {children}
        </main>
      </div>
    </div>
  );
};
