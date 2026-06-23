import React, { createContext, useState, useEffect, useContext } from 'react';
import { api, setTokens, clearTokens, subscribeToTokenChanges } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Inscrever-se para escutar limpezas/alterações de token fora do fluxo do React
    const unsubscribe = subscribeToTokenChanges((updatedUser) => {
      if (updatedUser === null) {
        setUser(null);
        localStorage.removeItem('user');
      } else if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    });

    // Validar se há uma sessão ativa
    const token = localStorage.getItem('accessToken');
    if (!token) {
      clearTokens();
      setUser(null);
    }
    setIsLoading(false);

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      setTokens(data.accessToken, data.refreshToken, data.user);
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    } catch (error) {
      clearTokens();
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    const refresh = localStorage.getItem('refreshToken');
    try {
      if (refresh) {
        await api.post('/auth/logout', { refreshToken: refresh });
      }
    } catch (err) {
      console.warn('Erro ao notificar logout no servidor:', err);
    } finally {
      clearTokens();
      setUser(null);
      setIsLoading(false);
    }
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (typeof roles === 'string') {
      return user.perfil === roles;
    }
    return roles.includes(user.perfil);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
