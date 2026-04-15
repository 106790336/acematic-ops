import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/MotionPrimitives';
import { ChevronRight, ChevronDown, Eye } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TaskItem {
  id: string;
  taskNumber: string;
  title: string;
  status: string;
  progress: number;
  priority: string;
  dueDate: string;
  assignee?: { id: string; name: string };
  parentTaskId?: string;
  subTasks: TaskItem[];
}

interface PlanItem {
  id: string;
  title: string;
  status: string;
  progress: number;
  priority: string;
  strategyId?: string;
  department?: { id: string; name: string };
  owner?: { id: string; name: string };
  tasks: TaskItem[];
}

interface StrategyItem {
  id: string;
  title: string;
  status: string;
  progress: number;
  plans: PlanItem[];
}

export default function AlignmentView() {
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<any>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, pRes, tRes] = await Promise.all([
        apiClient.get('/strategies?limit=100'),
        apiClient.get('/plans?limit=100'),
        apiClient.get('/tasks-v2?limit=200'),
      ]);

      const strategyList = sRes.data.data?.items || [];
      const planList = pRes.data.data?.items || [];
      const taskList = tRes.data.data?.items || [];

      // 构建树形结构
      const taskMap = new Map<string, TaskItem>();
      taskList.forEach((t: any) => taskMap.set(t.id, { ...t, subTasks: [] }));
      
      taskList.forEach((t: any) => {
        if (t.parentTaskId && taskMap.has(t.parentTaskId)) {
          taskMap.get(t.parentTaskId)!.subTasks.push(taskMap.get(t.id)!);
        }
      });

      const planMap = new Map<string, PlanItem>();
      planList.forEach((p: any) => planMap.set(p.id, { ...p, tasks: [] }));

      taskList.forEach((t: any) => {
        if (t.planId && planMap.has(t.planId) && !t.parentTaskId) {
          planMap.get(t.planId)!.tasks.push(taskMap.get(t.id)!);
        }
      });

      const result = strategyList.map((s: any) => ({
        ...s,
        plans: planList.filter((p: any) => p.strategyId === s.id).map((p: any) => planMap.get(p.id)!),
      }));

      setStrategies(result);
      setExpandedStrategies(new Set(strategyList.map((s: any) => s.id)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStrategy = (id: string) => {
    const newSet = new Set(expandedStrategies);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedStrategies(newSet);
  };

  const togglePlan = (id: string) => {
    const newSet = new Set(expandedPlans);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedPlans(newSet);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-blue-100 text-blue-700', in_progress: 'bg-cyan-100 text-cyan-700',
      completed: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700', rejected: 'bg-red-100 text-red-700',
      verified: 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      active: '进行中', in_progress: '进行中', completed: '已完成', pending: '待处理',
      confirmed: '已确认', rejected: '已驳回', verified: '已验收',
    };
    return texts[status] || status;
  };

  const getCode = (title: string) => {
    const match = title.match(/^([A-Z]\d+(?:\.\d+)*)/);
    return match ? match[1] : null;
  };

  const renderTask = (task: TaskItem, level: number = 2) => {
    const hasSubtasks = task.subTasks && task.subTasks.length > 0;
    const code = getCode(task.title) || task.taskNumber;

    return (
      <div key={task.id} className="mb-1">
        <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer group" style={{ marginLeft: level * 20 }}
          onClick={() => hasSubtasks && togglePlan(task.id)}>
          {hasSubtasks ? (expandedPlans.has(task.id) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />) : <div className="w-5" />}
          <Badge variant="outline" className="text-xs font-mono">{code}</Badge>
          <span className="flex-1 text-sm truncate">{task.title.replace(/^[A-Z]\d+(?:\.\d+)*\s*/, '')}</span>
          <span className="text-xs text-muted-foreground">{task.assignee?.name || '-'}</span>
          <Progress value={task.progress || 0} className="w-12 h-1.5" />
          <span className="text-xs w-8 text-right">{task.progress || 0}%</span>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setDetailItem({ type: 'task', data: task }); }}><Eye className="w-3 h-3" /></Button>
        </div>
        {hasSubtasks && expandedPlans.has(task.id) && task.subTasks.map(st => renderTask(st, level + 1))}
      </div>
    );
  };

  const renderPlan = (plan: PlanItem) => {
    const hasTasks = plan.tasks && plan.tasks.length > 0;
    const code = getCode(plan.title);

    return (
      <div key={plan.id} className="mb-2 border-l-2 border-blue-200 pl-3">
        <div className="flex items-center gap-2 p-2 rounded hover:bg-blue-50/50 cursor-pointer group" onClick={() => hasTasks && togglePlan(plan.id)}>
          {hasTasks ? (expandedPlans.has(plan.id) ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-blue-500" />) : <div className="w-5" />}
          {code && <Badge className="bg-blue-100 text-blue-700 text-xs font-mono">{code}</Badge>}
          <span className="flex-1 font-medium text-sm">{plan.title.replace(/^[A-Z]\d+(?:\.\d+)*\s*/, '')}</span>
          <span className="text-xs text-muted-foreground">{plan.department?.name || '-'}</span>
          <Badge className={getStatusBadge(plan.status)}>{getStatusText(plan.status)}</Badge>
          <Progress value={plan.progress || 0} className="w-12 h-1.5" />
          <span className="text-xs w-8 text-right">{plan.progress || 0}%</span>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setDetailItem({ type: 'plan', data: plan }); }}><Eye className="w-3 h-3" /></Button>
        </div>
        {hasTasks && expandedPlans.has(plan.id) && <div className="mt-1 ml-4">{plan.tasks.map(t => renderTask(t))}</div>}
      </div>
    );
  };

  const renderStrategy = (strategy: StrategyItem, index: number) => {
    const hasPlans = strategy.plans && strategy.plans.length > 0;
    const isExpanded = expandedStrategies.has(strategy.id);

    return (
      <div key={strategy.id} className="mb-4 border rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 cursor-pointer" onClick={() => toggleStrategy(strategy.id)}>
          <Badge className="bg-purple-600 text-white text-sm font-mono px-3 py-1">O{index + 1}</Badge>
          <div className="flex-1">
            <div className="font-medium">{strategy.title}</div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-muted-foreground">{hasPlans ? `${strategy.plans.length} 个计划` : '无计划'}</span>
              <Badge className={getStatusBadge(strategy.status)}>{getStatusText(strategy.status)}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={strategy.progress || 0} className="w-24 h-2" />
            <span className="text-sm font-medium">{strategy.progress || 0}%</span>
            {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
          </div>
        </div>
        {isExpanded && hasPlans && <div className="p-4 bg-white">{strategy.plans.map(p => renderPlan(p))}</div>}
      </div>
    );
  };

  if (loading) return <div className="space-y-6 p-6">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl">战略对齐视图</h1>
            <p className="text-muted-foreground text-sm">OKR层级结构：战略(O) → 计划(K) → 任务(T)</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge className="bg-purple-600 text-white">O = 战略目标</Badge>
            <Badge className="bg-blue-100 text-blue-700">K = 关键结果</Badge>
            <Badge variant="outline">T = 任务</Badge>
          </div>
        </div>
      </FadeIn>

      <FadeIn>
        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-purple-600">{strategies.length}</div><div className="text-sm text-muted-foreground">战略目标 (O)</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-blue-600">{strategies.reduce((s, st) => s + (st.plans?.length || 0), 0)}</div><div className="text-sm text-muted-foreground">工作计划 (K)</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-cyan-600">{strategies.reduce((s, st) => s + (st.plans?.reduce((s2, p) => s2 + (p.tasks?.length || 0), 0) || 0), 0)}</div><div className="text-sm text-muted-foreground">任务总数 (T)</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-green-600">{Math.round(strategies.reduce((s, st) => s + (st.progress || 0), 0) / Math.max(strategies.length, 1))}%</div><div className="text-sm text-muted-foreground">平均进度</div></CardContent></Card>
        </div>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">OKR 层级结构</CardTitle></CardHeader>
          <CardContent>
            {strategies.length === 0 ? <div className="text-center py-12 text-muted-foreground">暂无数据</div> : strategies.map((s, i) => renderStrategy(s, i))}
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{detailItem?.type === 'plan' ? '计划详情' : '任务详情'}</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">编号：</span>{getCode(detailItem.data.title) || detailItem.data.taskNumber}</div>
              <div><span className="text-muted-foreground">名称：</span>{detailItem.data.title}</div>
              <div><span className="text-muted-foreground">状态：</span><Badge className={getStatusBadge(detailItem.data.status)}>{getStatusText(detailItem.data.status)}</Badge></div>
              <div><span className="text-muted-foreground">进度：</span>{detailItem.data.progress}%</div>
              {detailItem.data.assignee && <div><span className="text-muted-foreground">执行人：</span>{detailItem.data.assignee.name}</div>}
              {detailItem.data.department && <div><span className="text-muted-foreground">部门：</span>{detailItem.data.department.name}</div>}
              {detailItem.data.dueDate && <div><span className="text-muted-foreground">截止日期：</span>{detailItem.data.dueDate?.split('T')[0]}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
