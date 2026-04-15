import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { Target, AlertTriangle, TrendingUp } from 'lucide-react';

interface AlignmentStats {
  totalTasks: number;
  alignedTasks: number;
  overallRate: number;
  departmentAlignment: Array<{
    departmentId: string;
    departmentName: string;
    total: number;
    aligned: number;
    rate: number;
  }>;
  warnings: Array<{ departmentId: string; rate: number; level: string }>;
  reminders: Array<{ departmentId: string; rate: number; level: string }>;
}

export function AlignmentStatsCard() {
  const [stats, setStats] = useState<AlignmentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/tasks-v2/stats/alignment');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch alignment stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4" />
            战略对齐度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4" />
          战略对齐度
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 整体对齐度 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">公司整体</span>
            <span className={`text-2xl font-bold ${getRateColor(stats.overallRate)}`}>
              {stats.overallRate}%
            </span>
          </div>
          <Progress 
            value={stats.overallRate} 
            className="h-2"
          />
          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
            <span>已对齐 {stats.alignedTasks} 项</span>
            <span>共 {stats.totalTasks} 项任务</span>
          </div>
        </div>

        {/* 部门对齐度 */}
        {stats.departmentAlignment.length > 0 && (
          <div className="space-y-2 mb-4">
            <div className="text-xs font-medium text-muted-foreground">部门对齐度</div>
            {stats.departmentAlignment.slice(0, 4).map((dept) => (
              <div key={dept.departmentId} className="flex items-center justify-between">
                <span className="text-sm">
                  {dept.departmentName || '未分配部门'}
                </span>
                <div className="flex items-center gap-2">
                  <Progress value={dept.rate} className="w-16 h-1.5" />
                  <span className={`text-xs font-medium ${getRateColor(dept.rate)}`}>
                    {dept.rate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 预警信息 */}
        {(stats.warnings.length > 0 || stats.reminders.length > 0) && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              预警提醒
            </div>
            <div className="space-y-1">
              {stats.warnings.slice(0, 2).map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-red-50 text-red-700">
                  <AlertTriangle className="w-3 h-3" />
                  <span>某部门对齐度仅 {w.rate}%</span>
                </div>
              ))}
              {stats.reminders.slice(0, 2).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-yellow-50 text-yellow-700">
                  <TrendingUp className="w-3 h-3" />
                  <span>某部门对齐度 {r.rate}%，需改进</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 图例 */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>≥90% 正常</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>70-90% 提醒</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>&lt;70% 预警</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
