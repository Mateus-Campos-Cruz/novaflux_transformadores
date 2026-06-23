import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login/Login';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Materiais } from './pages/Materiais/Materiais';
import { Projetos } from './pages/Projetos/Projetos';
import { ProjetoDetalhes } from './pages/Projetos/ProjetoDetalhes';
import { Reservas } from './pages/Reservas/Reservas';
import { Compras } from './pages/Compras/Compras';
import { Auditoria } from './pages/Auditoria/Auditoria';

/**
 * Componente de Proteção de Rotas.
 * Impede o acesso de usuários não autenticados ou sem os perfis de acesso necessários.
 */
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-state" style={{ height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="spin" style={{ width: '40px', height: '40px', border: '4px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%' }}></div>
        <span>Validando credenciais e carregando painel...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRole(roles)) {
    console.warn(`Tentativa de acesso não autorizada. Perfis exigidos: ${roles}`);
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          
          {/* Rotas Protegidas Globais */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/materiais" element={
            <ProtectedRoute>
              <Materiais />
            </ProtectedRoute>
          } />
          
          <Route path="/projetos" element={
            <ProtectedRoute>
              <Projetos />
            </ProtectedRoute>
          } />
          
          <Route path="/projetos/:id" element={
            <ProtectedRoute>
              <ProjetoDetalhes />
            </ProtectedRoute>
          } />
          
          {/* Rotas Protegidas por Perfis Específicos */}
          <Route path="/reservas" element={
            <ProtectedRoute roles={['administrador', 'almoxarife', 'engenharia']}>
              <Reservas />
            </ProtectedRoute>
          } />
          
          <Route path="/compras" element={
            <ProtectedRoute roles={['administrador', 'compras', 'engenharia', 'almoxarife']}>
              <Compras />
            </ProtectedRoute>
          } />
          
          <Route path="/auditoria" element={
            <ProtectedRoute roles={['administrador']}>
              <Auditoria />
            </ProtectedRoute>
          } />

          {/* Rota Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
