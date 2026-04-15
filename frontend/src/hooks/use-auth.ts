import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import type { User, LoginRequest, LoginResponse, ApiResponse } from '@/types';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_info';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = useCallback(async (credentials: LoginRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
      
      if (response.data.success && response.data.data) {
        const { token, user } = response.data.data;
        
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setUser(user);
        
        navigate('/dashboard');
        return true;
      } else {
        setError(response.data.error || '登录失败');
        return false;
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const getProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ApiResponse<User>>('/auth/profile');
      
      if (response.data.success && response.data.data) {
        const user = response.data.data;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setUser(user);
        return user;
      }
      return null;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const isAuthenticated = !!user;

  return {
    user,
    loading,
    error,
    login,
    logout,
    getProfile,
    isAuthenticated,
    setError,
  };
}
