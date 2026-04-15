import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FadeIn } from '@/components/MotionPrimitives';
import { Plus, Calendar, Clock, CheckCircle, AlertCircle, Edit, Trash2, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import type { DailyLog as DailyLogType, ApiResponse, PaginatedResponse } from '@/types';

interface MyTask {
  id: string;
  title: string;
  status: string;
  progress: number;
  priority: string;
  dueDate: string;
  plan?: { id: string; title: string };
}

interface TaskExecutionItem {
  id?: string;
  taskId?: string;
  taskName: string;
  description?: string;
  planHours?: number;
  actualHours?: number;
  status: string;
  completion: number;
  result?: string;
  task?: { id: string; title: string; status: string; progress: number };
}

const emptyForm = {
  logDate: new Date().toISOString().split('T')[0],
  weeklyPlanId: '',
  workContent: '',
  achievements: '',
  workHours: 8,
  progress: 0,
  problems: '',
  nextDayPlan: '',
  tasks: [] as TaskExecutionItem[],
};

export default function DailyLog() {
  const [logs, setLogs] = useState<DailyLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todayLog, setTodayLog] = useState<DailyLogType | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [editItem, setEditItem] = useState<DailyLogType | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 7);

      const response = await apiClient.get<ApiResponse<PaginatedResponse<DailyLogType>>>(
        `/execution?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      if (response.data.success && response.data.data) {
        setLogs(response.data.data.items);
      }
    } catch (err) {
      console.error('Fetch logs error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  const checkTodayLog = useCallback(async () => {
    try {
      const response = await apiClient.get<ApiResponse<DailyLogType>>('/execution/today');
      if (response.data.success && response.data.data) {
        setTodayLog(response.data.data);
      } else {
        setTodayLog(null);
      }
    } catch (err) {
      console.error('Check today log error:', err);
      setTodayLog(null);
    }
  }, []);

  const fetchMyTasks = useCallback(async () => {
    try {
      const response = await apiClient.get<ApiResponse<MyTask[]>>('/execution/my-tasks');
      if (response.data.success && response.data.data) {
        setMyTasks(response.data.data);
      }
    } catch (err) {
      console.error('Fetch my tasks error:', err);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    checkTodayLog();
    fetchMyTasks();
  }, [fetchLogs, checkTodayLog, fetchMyTasks]);

  const populateForm = (log: DailyLogType) => {
    setEditItem(log);
    const tasks = (log as any).tasks?.map((t: any) => ({
      id: t.id,
      taskId: t.taskId || undefined,
      taskName: t.taskName,
      description: t.description || '',
      planHours: t.planHours,
      actualHours: t.actualHours,
      status: t.status || '进行中',
      completion: t.completion || 0,
      result: t.result || '',
      task: t.task,
    })) || [];
    setForm({
      logDate: log.logDate.split('T')[0],
      weeklyPlanId: log.weeklyPlanId || '',
      workContent: log.workContent,
      achievements: log.achievements || '',
      workHours: log.workHours,
      progress: log.progress,
      problems: log.problems || '',
      nextDayPlan: log.nextDayPlan || '',
      tasks,
    });
  };

  const resetForm = () => {
    setEditItem(null);
    setForm({ ...emptyForm });
  };

  const openCreate = () => {
    resetForm();
    if (todayLog) {
      populateForm(todayLog);
    }
    setDialogOpen(true);
  };

  const onEdit = (log: DailyLogType) => {
    populateForm(log);
    setDialogOpen(true);
  };

  const onDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editItem) {
        await apiClient.put(`/execution/${editItem.id}`, form);
      } else {
        await apiClient.post('/execution', form);
      }
      setDialogOpen(false);
      resetForm();
      fetchLogs();
      checkTodayLog();
    } catch (err: any) {
      alert(err.response?.data?.error || getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('确定删除该日志？')) return;
    try {
      await apiClient.delete(`/execution/${id}`);
      fetchLogs();
      checkTodayLog();
    } catch (err: any) {
      alert(err.response?.data?.error || getErrorMessage(err));
    }
  };

  // 添加任务执行记录
  const addTask = (taskId?: string) => {
    const task = taskId ? myTasks.find(t => t.id === taskId) : null;
    setForm({
      ...form,
      tasks: [
        ...form.tasks,
        {
          taskId: taskId || undefined,
          taskName: task?.title || '',
          status: '进行中',
          completion: task?.progress || 0,
        },
      ],
    });
  };

  // 更新任务执行记录
  const updateTask = (index: number, field: string, value: any) => {
    const newTasks = [...form.tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setForm({ ...form, tasks: newTasks });
  };

  // 选择关联任务
  const selectTaskForIndex = (index: number, taskId: string) => {
    const task = myTasks.find(t => t.id === taskId);
    if (task) {
      const newTasks = [...form.tasks];
      newTasks[index] = {
        ...newTasks[index],
        taskId: task.id,
        taskName: task.title,
        completion: task.progress,
      };
      setForm({ ...form, tasks: newTasks });
    }
  };

  const removeTask = (index: number) => {
    const newTasks = form.tasks.filter((_, i) => i !== index);
    setForm({ ...form, tasks: newTasks });
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'oklch(0.60 0.15 163)';
    if (progress >= 50) return 'oklch(0.75 0.18 75)';
    return 'oklch(0.55 0.22 25)';
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: '已确认', color: 'bg-blue-100 text-blue-700' },
    in_progress: { label: '进行中', color: 'bg-cyan-100 text-cyan-700' },
    completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl">每日执行日志</h1>
            <p className="text-muted-foreground text-sm">记录每日工作内容，关联执行的任务</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {todayLog ? '更新日志' : '填写今日日志'}
          </Button>
        </div>
      </FadeIn>

      {/* 今日概览 */}
      {todayLog && (
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  今日工作概览
                </div>
                <Button size="sm" variant="outline" onClick={() => onEdit(todayLog)}>
                  <Edit className="w-4 h-4 mr-2" />编辑
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold">{todayLog.workHours}h</div>
                    <div className="text-sm text-muted-foreground">工作时长</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: getProgressColor(todayLog.progress) }} />
                    <div className="text-2xl font-bold">{todayLog.progress}%</div>
                    <div className="text-sm text-muted-foreground">完成进度</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                    <div className="text-2xl font-bold">{(todayLog as any).tasks?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">执行任务</div>
                  </div>
                </div>
                <div className="font-medium">工作内容</div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{todayLog.workContent}</div>
                {(todayLog as any).tasks?.length > 0 && (
                  <div>
                    <div className="font-medium mb-2">关联任务</div>
                    <div className="space-y-2">
                      {(todayLog as any).tasks.map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded border text-sm">
                          <div className="flex items-center gap-2">
                            {t.taskId ? <Link2 className="w-3 h-3 text-blue-500" /> : null}
                            <span>{t.taskName}</span>
                            {t.task && <Badge variant="outline" className="text-xs">{t.task.title}</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{t.actualHours || 0}h</span>
                            <Badge className={statusMap[t.status]?.color || ''}>{t.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* 历史日志 */}
      <FadeIn>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>历史日志</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => {
                  const date = new Date(currentDate);
                  date.setDate(date.getDate() - 7);
                  setCurrentDate(date.toISOString().split('T')[0]);
                }}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                  {new Date(currentDate).toLocaleDateString('zh-CN', { month: 'short', year: 'numeric' })}
                </span>
                <Button size="icon" variant="outline" onClick={() => {
                  const date = new Date(currentDate);
                  date.setDate(date.getDate() + 7);
                  setCurrentDate(date.toISOString().split('T')[0]);
                }}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">暂无日志记录</p>
                <Button className="mt-4" onClick={openCreate}>填写第一份日志</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium bg-blue-500">
                          {new Date(log.logDate).getDate()}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{new Date(log.logDate).toLocaleDateString('zh-CN', { weekday: 'long' })}</div>
                          <div className="text-xs text-muted-foreground">{log.user?.name} · {log.department?.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{log.workHours}h</Badge>
                        <Badge style={{ background: getProgressColor(log.progress), color: 'white' }}>{log.progress}%</Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground line-clamp-2">{log.workContent}</div>
                    <div className="flex gap-2 mt-2">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(log)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(log.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* 填写/编辑日志对话框 */}
      <Dialog open={dialogOpen} onOpenChange={onDialogChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? '编辑' : '填写'}工作日志</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>日期</Label><Input type="date" value={form.logDate} onChange={(e) => setForm({ ...form, logDate: e.target.value })} required /></div>
              <div className="space-y-2"><Label>工作时长(小时)</Label><Input type="number" value={form.workHours} onChange={(e) => setForm({ ...form, workHours: parseFloat(e.target.value) })} min="0" max="24" step="0.5" /></div>
              <div className="space-y-2"><Label>完成进度(%)</Label><Input type="number" value={form.progress} onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) })} min="0" max="100" /></div>
            </div>

            <div className="space-y-2"><Label>今日工作内容 *</Label><Textarea value={form.workContent} onChange={(e) => setForm({ ...form, workContent: e.target.value })} placeholder="详细记录今天完成的工作" rows={4} required /></div>

            <div className="space-y-2"><Label>完成成果</Label><Textarea value={form.achievements} onChange={(e) => setForm({ ...form, achievements: e.target.value })} placeholder="记录今天的工作成果、交付物" rows={3} /></div>

            {/* 关联任务执行 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>关联任务执行（选择今日执行的任务）</Label>
                <div className="flex gap-2">
                  {myTasks.length > 0 && (
                    <select className="text-sm border rounded px-2 py-1" onChange={(e) => {
                      if (e.target.value) addTask(e.target.value);
                      e.target.value = '';
                    }}>
                      <option value="">+ 快速添加任务</option>
                      {myTasks.filter(t => !form.tasks.some(ft => ft.taskId === t.id)).map(t => (
                        <option key={t.id} value={t.id}>{t.title} ({t.progress}%)</option>
                      ))}
                    </select>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => addTask()}><Plus className="w-4 h-4 mr-2" />手动添加</Button>
                </div>
              </div>

              {form.tasks.map((task, index) => (
                <div key={index} className="p-3 rounded-lg border space-y-2 bg-muted/30">
                  <div className="flex items-start gap-2">
                    {/* 任务选择 */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <select value={task.taskId || ''} onChange={(e) => selectTaskForIndex(index, e.target.value)} className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm flex-1">
                          <option value="">-- 关联任务 --</option>
                          {myTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                        {task.taskId && <Link2 className="w-4 h-4 text-blue-500" />}
                      </div>
                      <Input placeholder="任务名称（或从上方选择关联任务）" value={task.taskName} onChange={(e) => updateTask(index, 'taskName', e.target.value)} />
                    </div>
                    <Input type="number" placeholder="计划h" value={task.planHours || ''} onChange={(e) => updateTask(index, 'planHours', parseFloat(e.target.value) || 0)} className="w-20" />
                    <Input type="number" placeholder="实际h" value={task.actualHours || ''} onChange={(e) => updateTask(index, 'actualHours', parseFloat(e.target.value) || 0)} className="w-20" />
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeTask(index)}>×</Button>
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="执行描述/结果" value={task.description || ''} onChange={(e) => updateTask(index, 'description', e.target.value)} className="flex-1" />
                    <Input type="number" placeholder="完成%" value={task.completion} onChange={(e) => updateTask(index, 'completion', parseInt(e.target.value) || 0)} className="w-20" />
                    <select value={task.status} onChange={(e) => updateTask(index, 'status', e.target.value)} className="w-24 border rounded px-2">
                      <option value="进行中">进行中</option><option value="已完成">已完成</option><option value="暂停">暂停</option>
                    </select>
                  </div>
                </div>
              ))}
              {form.tasks.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg border-dashed">
                  点击"快速添加任务"选择您正在执行的任务，或"手动添加"填写任务明细
                </div>
              )}
            </div>

            <div className="space-y-2"><Label>遇到的问题</Label><Textarea value={form.problems} onChange={(e) => setForm({ ...form, problems: e.target.value })} placeholder="记录工作中遇到的问题和困难" rows={2} /></div>
            <div className="space-y-2"><Label>明日计划</Label><Textarea value={form.nextDayPlan} onChange={(e) => setForm({ ...form, nextDayPlan: e.target.value })} placeholder="计划明天要完成的工作" rows={2} /></div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onDialogChange(false)}>取消</Button>
              <Button type="submit" disabled={submitting}>{submitting ? '提交中...' : (editItem ? '保存' : '提交')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
