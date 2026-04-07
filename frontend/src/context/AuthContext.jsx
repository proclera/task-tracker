import { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredSession();
      setUser(null);
      navigate('/login?reason=expired', { replace: true });
    };

    setUnauthorizedHandler(handleUnauthorized);

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [navigate]);

  useEffect(() => {
    const hydrateAuth = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        const authenticatedUser = response.data.user;
        localStorage.setItem('user', JSON.stringify(authenticatedUser));
        setUser(authenticatedUser);
      } catch (error) {
        clearStoredSession();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    hydrateAuth();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const register = async (email, password, role, firstName, lastName) => {
    const response = await api.post('/auth/register', { email, password, role, firstName, lastName });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    clearStoredSession();
    setUser(null);
    navigate('/login?reason=logged-out', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
