import { useState, useEffect, useCallback } from 'react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import type { 
  Plan, 
  ApiResponse, 
  PaginatedResponse
} from '@/types';

interface PlanFilters {
  type?: string;
  status?: string;
  departmentId?: string;
  strategyId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface CreatePlanData {
  title: string;
  description?: string;
  type?: 'company' | 'department' | 'personal';
  strategyId?: string;
  departmentId?: string;
  startDate: string;
  endDate: string;
  priority?: 'high' | 'medium' | 'low';
}

interface UpdatePlanData extends Partial<CreatePlanData> {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress?: number;
}

export function usePlans(filters?: PlanFilters) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.type) params.append('type', filters.type);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.departmentId) params.append('departmentId', filters.departmentId);
      if (filters?.strategyId) params.append('strategyId', filters.strategyId);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.limit) params.append('limit', String(filters.limit));

      const response = await apiClient.get<ApiResponse<PaginatedResponse<Plan>>>(
        `/plans?${params.toString()}`
      );
      
      if (response.data.success && response.data.data) {
        setPlans(response.data.data.items);
        setTotal(response.data.data.total);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters?.type, filters?.status, filters?.departmentId, filters?.strategyId, filters?.search, filters?.page, filters?.limit]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const createPlan = useCallback(async (data: CreatePlanData) => {
    try {
      const response = await apiClient.post<ApiResponse<Plan>>('/plans', data);
      
      if (response.data.success && response.data.data) {
        await fetchPlans();
        return response.data.data;
      }
      throw new Error(response.data.error || '创建失败');
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, [fetchPlans]);

  const updatePlan = useCallback(async (id: string, data: UpdatePlanData) => {
    try {
      const response = await apiClient.put<ApiResponse<Plan>>(`/plans/${id}`, data);
      
      if (response.data.success && response.data.data) {
        await fetchPlans();
        return response.data.data;
      }
      throw new Error(response.data.error || '更新失败');
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, [fetchPlans]);

  const deletePlan = useCallback(async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse>(`/plans/${id}`);
      
      if (response.data.success) {
        await fetchPlans();
        return true;
      }
      throw new Error(response.data.error || '删除失败');
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, [fetchPlans]);

  return {
    plans,
    total,
    loading,
    error,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
  };
}

export function usePlan(id: string | undefined) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await apiClient.get<ApiResponse<Plan>>(`/plans/${id}`);
      
      if (response.data.success && response.data.data) {
        setPlan(response.data.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { plan, loading, error, fetchPlan };
}
