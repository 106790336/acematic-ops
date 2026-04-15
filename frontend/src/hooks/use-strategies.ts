import { useState, useEffect, useCallback } from 'react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import type { 
  Strategy, 
  ApiResponse, 
  PaginatedResponse
} from '@/types';

interface StrategyFilters {
  year?: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface CreateStrategyData {
  title: string;
  description?: string;
  year: number;
  startDate: string;
  endDate: string;
}

interface UpdateStrategyData extends Partial<CreateStrategyData> {
  status?: 'draft' | 'active' | 'completed' | 'archived';
  progress?: number;
}

export function useStrategies(filters?: StrategyFilters) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.year) params.append('year', String(filters.year));
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.limit) params.append('limit', String(filters.limit));

      const response = await apiClient.get<ApiResponse<PaginatedResponse<Strategy>>>(
        `/strategies?${params.toString()}`
      );
      
      if (response.data.success && response.data.data) {
        setStrategies(response.data.data.items);
        setTotal(response.data.data.total);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters?.year, filters?.status, filters?.search, filters?.page, filters?.limit]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  const createStrategy = useCallback(async (data: CreateStrategyData) => {
    try {
      const response = await apiClient.post<ApiResponse<Strategy>>('/strategies', data);
      
      if (response.data.success && response.data.data) {
        await fetchStrategies();
        return response.data.data;
      }
      throw new Error(response.data.error || '创建失败');
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, [fetchStrategies]);

  const updateStrategy = useCallback(async (id: string, data: UpdateStrategyData) => {
    try {
      const response = await apiClient.put<ApiResponse<Strategy>>(`/strategies/${id}`, data);
      
      if (response.data.success && response.data.data) {
        await fetchStrategies();
        return response.data.data;
      }
      throw new Error(response.data.error || '更新失败');
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, [fetchStrategies]);

  const deleteStrategy = useCallback(async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse>(`/strategies/${id}`);
      
      if (response.data.success) {
        await fetchStrategies();
        return true;
      }
      throw new Error(response.data.error || '删除失败');
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, [fetchStrategies]);

  return {
    strategies,
    total,
    loading,
    error,
    fetchStrategies,
    createStrategy,
    updateStrategy,
    deleteStrategy,
  };
}

export function useStrategy(id: string | undefined) {
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategy = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await apiClient.get<ApiResponse<Strategy>>(`/strategies/${id}`);
      
      if (response.data.success && response.data.data) {
        setStrategy(response.data.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  return { strategy, loading, error, fetchStrategy };
}
