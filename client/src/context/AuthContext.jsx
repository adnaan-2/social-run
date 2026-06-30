import { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      // Connect to Socket.io backend
      const socketUrl = 'http://localhost:5000';
      const newSocket = io(socketUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
      }
      setSocket(null);
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (username, email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/signup', { username, email, password });
      setUser(response.data.user);
      return response;
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
      throw err;
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password, rememberMe });
      setUser(response.data.user);
      return response;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    }
  };

  const googleLogin = async (credential) => {
    try {
      setError(null);
      const response = await api.post('/auth/google', { credential });
      setUser(response.data.user);
      return response;
    } catch (err) {
      setError(err.response?.data?.message || 'Google login failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // logout anyway
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (data) => {
    try {
      setError(null);
      const response = await api.put('/auth/profile', data);
      setUser(response.data.user);
      return response;
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
      throw err;
    }
  };

  const value = {
    user,
    setUser,
    loading,
    error,
    setError,
    socket,
    isAuthenticated: !!user,
    signup,
    login,
    googleLogin,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

