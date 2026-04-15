import { useState, useEffect } from 'react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import type {
  DashboardData,
  Strategy,
  Plan,
  DepartmentPerformance,
  AssessmentTrend,
  ApiResponse,
  PaginatedResponse,
} from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FadeIn, Stagger } from '@/components/MotionPrimitives';
import { AlignmentStatsCard } from '@/components/AlignmentStatsCard';
import {
  Target,
  ClipboardList,
  CheckCircle2,
  Clock,
  Users,
  Building2,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';

export default function Dashboard() {
  const [overview, setOverview] = useState<DashboardData | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [recentPlans, setRecentPlans] = useState<Plan[]>([]);
  const [departmentPerformance, setDepartmentPerformance] = useState<DepartmentPerformance[]>([]);
  const [assessmentTrends, setAssessmentTrends] = useState<AssessmentTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [overviewRes, strategyRes, plansRes, deptRes, trendRes] = await Promise.all([
          apiClient.get<ApiResponse<DashboardData>>('/dashboard/overview'),
          apiClient.get<ApiResponse<PaginatedResponse<Strategy>>>('/strategies?limit=5'),
          apiClient.get<ApiResponse<PaginatedResponse<Plan>>>('/plans?limit=5'),
          apiClient.get<ApiResponse<DepartmentPerformance[]>>('/dashboard/department-performance').catch(() => null),
          apiClient.get<ApiResponse<AssessmentTrend[]>>('/dashboard/assessment-trends').catch(() => null),
        ]);

        if (overviewRes.data.success && overviewRes.data.data) {
          setOverview(overviewRes.data.data);
        }
        if (strategyRes.data.success && strategyRes.data.data) {
          setStrategies(strategyRes.data.data.items || []);
        }
        if (plansRes.data.success && plansRes.data.data) {
          setRecentPlans(plansRes.data.data.items || []);
        }
        if (deptRes && deptRes.data.success && deptRes.data.data) {
          setDepartmentPerformance(deptRes.data.data);
        }
        if (trendRes && trendRes.data.success && trendRes.data.data) {
          setAssessmentTrends(trendRes.data.data);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    high: 'destructive',
    medium: 'default',
    low: 'secondary',
  };

  const planStatusData = overview ? [
    { name: '进行中', value: overview.plans.inProgress, color: 'oklch(0.58 0.20 250)' },
    { name: '已完成', value: overview.plans.completed, color: 'oklch(0.60 0.15 163)' },
    { name: '待处理', value: overview.plans.total - overview.plans.inProgress - overview.plans.completed, color: 'oklch(0.75 0.18 75)' },
  ] : [];

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="font-bold"
              style={{
                fontSize: 'var(--font-size-headline)',
                color: 'var(--foreground)',
              }}
            >
              数据看板
            </h1>
            <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-label)', marginTop: 'var(--spacing-xs)' }}>
              企业战略执行全貌一览
            </p>
          </div>
        </div>
      </FadeIn>

      {/* 统计卡片 */}
      <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">战略目标</p>
                <p className="text-2xl font-bold mt-1">{overview?.strategies.total || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  进行中 {overview?.strategies.active || 0}
                </p>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ background: 'oklch(0.94 0.01 250)' }}
              >
                <Target className="w-6 h-6" style={{ color: 'oklch(0.42 0.19 250)' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">工作计划</p>
                <p className="text-2xl font-bold mt-1">{overview?.plans.total || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  完成率 {overview?.plans.completionRate || 0}%
                </p>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ background: 'oklch(0.95 0.04 75)' }}
              >
                <ClipboardList className="w-6 h-6" style={{ color: 'oklch(0.75 0.18 75)' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">待办任务</p>
                <p className="text-2xl font-bold mt-1">{overview?.tasks.pending || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  总计 {overview?.tasks.total || 0}
                </p>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ background: 'oklch(0.95 0.02 163)' }}
              >
                <Clock className="w-6 h-6" style={{ color: 'oklch(0.60 0.15 163)' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">部门数量</p>
                <p className="text-2xl font-bold mt-1">{overview?.departments || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  员工 {overview?.users || 0} 人
                </p>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ background: 'oklch(0.95 0.02 250)' }}
              >
                <Building2 className="w-6 h-6" style={{ color: 'oklch(0.58 0.20 250)' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </Stagger>

      {/* 战略对齐度卡片 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn className="lg:col-span-1">
          <AlignmentStatsCard />
        </FadeIn>

        {/* 预警提醒 */}
        <FadeIn className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                预警提醒
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm p-2 rounded bg-red-50 text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>本月营收目标进度落后，需重点关注</span>
                </div>
                <div className="flex items-center gap-2 text-sm p-2 rounded bg-yellow-50 text-yellow-700">
                  <Clock className="w-4 h-4" />
                  <span>3项计划即将到期，请及时跟进</span>
                </div>
                <div className="flex items-center gap-2 text-sm p-2 rounded bg-green-50 text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>运营中心招聘进度正常</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* 图表区域 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 战略进度 */}
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" style={{ color: 'oklch(0.42 0.19 250)' }} />
                战略目标进度
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {strategies.map((strategy) => (
                  <div key={strategy.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{strategy.title}</span>
                      <span className="text-muted-foreground">{strategy.progress}%</span>
                    </div>
                    <Progress value={strategy.progress} className="h-2" />
                  </div>
                ))}
                {strategies.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无战略目标
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* 计划状态分布 */}
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" style={{ color: 'oklch(0.75 0.18 75)' }} />
                计划状态分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {planStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {planStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* 部门绩效 */}
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: 'oklch(0.60 0.15 163)' }} />
                部门绩效排名
              </CardTitle>
            </CardHeader>
            <CardContent>
              {departmentPerformance.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentPerformance.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0 0)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'white',
                          border: '1px solid oklch(0.90 0 0)',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="completionRate" fill="oklch(0.42 0.19 250)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  暂无绩效数据
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* 考核趋势 */}
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: 'oklch(0.58 0.20 250)' }} />
                考核趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assessmentTrends.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={assessmentTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0 0)" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'white',
                          border: '1px solid oklch(0.90 0 0)',
                          borderRadius: '8px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgScore"
                        stroke="oklch(0.42 0.19 250)"
                        strokeWidth={2}
                        dot={{ fill: 'oklch(0.42 0.19 250)', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  暂无考核数据
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* 最近计划 */}
      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: 'oklch(0.60 0.15 163)' }} />
              最近计划
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between p-4 rounded-lg"
                  style={{ background: 'var(--muted)' }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.title}</span>
                      <Badge variant={priorityColors[plan.priority] as any}>
                        {plan.priority === 'high' ? '高优先' : plan.priority === 'medium' ? '中优先' : '低优先'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      {plan.department && <span>{plan.department.name}</span>}
                      {plan.owner && <span>负责人: {plan.owner.name}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{plan.progress}%</div>
                    <Progress value={plan.progress} className="w-24 h-2 mt-1" />
                  </div>
                </div>
              ))}
              {recentPlans.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  暂无最近计划
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
