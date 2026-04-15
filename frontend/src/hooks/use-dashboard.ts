import { useState, useEffect, useCallback } from 'react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import type { 
  DashboardData, 
  DepartmentPerformance,
  AssessmentTrend,
  ApiResponse
} from '@/types';

export function useDashboard() {
  const [overview, setOverview] = useState<DashboardData | null>(null);
  const [strategyProgress, setStrategyProgress] = useState<any[]>([]);
  const [departmentPerformance, setDepartmentPerformance] = useState<DepartmentPerformance[]>([]);
  const [assessmentTrends, setAssessmentTrends] = useState<AssessmentTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, strategyRes, deptRes, trendRes] = await Promise.all([
        apiClient.get<ApiResponse<DashboardData>>('/dashboard/overview'),
        apiClient.get<ApiResponse<any[]>>('/dashboard/strategy-progress'),
        apiClient.get<ApiResponse<DepartmentPerformance[]>>('/dashboard/department-performance'),
        apiClient.get<ApiResponse<AssessmentTrend[]>>('/dashboard/assessment-trends'),
      ]);

      if (overviewRes.data.success && overviewRes.data.data) {
        setOverview(overviewRes.data.data);
      }
      if (strategyRes.data.success && strategyRes.data.data) {
        setStrategyProgress(strategyRes.data.data);
      }
      if (deptRes.data.success && deptRes.data.data) {
        setDepartmentPerformance(deptRes.data.data);
      }
      if (trendRes.data.success && trendRes.data.data) {
        setAssessmentTrends(trendRes.data.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    overview,
    strategyProgress,
    departmentPerformance,
    assessmentTrends,
    loading,
    error,
    fetchDashboard,
  };
}
