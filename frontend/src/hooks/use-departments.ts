import { useState, useEffect, useCallback } from 'react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import type { 
  Department, 
  ApiResponse,
} from '@/types';

interface CreateDepartmentData {
  name: string;
  parentId?: string;
  managerId?: string;
  description?: string;
}

interface UpdateDepartmentData extends Partial<CreateDepartmentData> {}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ApiResponse<Department[]>>('/departments/list');
      
      if (response.data.success && response.data.data) {
        setDepartments(response.data.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const createDepartment = useCallback(async (data: CreateDepartmentData) => {
    try {
      const response = await apiClient.post<ApiResponse<Department>>('/departments', data);
      
      if (response.data.success && response.data.data) {
        await fetchDepartments();
        return response.data.data;
      }
      throw new Error(response.data.error || '创建失败');
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, [fetchDepartments]);

  const updateDepartment = useCallback(async (id: string, data: UpdateDepartmentData) => {
    try {
      const response = await apiClient.put<ApiResponse<Department>>(`/departments/${id}`, data);
      
      if (response.data.success && response.data.data) {
        await fetchDepartments();
        return response.data.data;
      }
      throw new Error(response.data.error || '更新失败');
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, [fetchDepartments]);

  const deleteDepartment = useCallback(async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse>(`/departments/${id}`);
      
      if (response.data.success) {
        await fetchDepartments();
        return true;
      }
      throw new Error(response.data.error || '删除失败');
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, [fetchDepartments]);

  return {
    departments,
    loading,
    error,
    fetchDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  };
}

export function useDepartmentTree() {
  const [tree, setTree] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ApiResponse<Department[]>>('/departments');
      
      if (response.data.success && response.data.data) {
        setTree(response.data.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return { tree, loading, error, fetchTree };
}
