import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FadeIn } from '@/components/MotionPrimitives';
import { Plus, Edit, Trash2, User, Clock, Eye, Link2, CheckCircle, ChevronDown, ChevronRight, GitBranch, Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Task } from '@/types';
import { usePermission } from '@/hooks/use-permission';

interface SimpleUser { id: string; name: string; position?: string; }
interface SimplePlan { id: string; title: string; strategy?: { title: string }; }

interface TaskWithSubtasks extends Task {
  subTasks?: TaskWithSubtasks[];
  parentTask?: { id: string; title: string };
}

export default function TaskManagement() {
  const { hasPermission, canEditContent, canDeleteContent, isAdmin, user } = usePermission();
  const [list, setList] = useState<TaskWithSubtasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetail, setShowDetail] = useState<TaskWithSubtasks | null>(null);
  const [showProgress, setShowProgress] = useState<TaskWithSubtasks | null>(null);
  const [showSubtask, setShowSubtask] = useState<TaskWithSubtasks | null>(null);
  const [showApproval, setShowApproval] = useState<TaskWithSubtasks | null>(null);
  const [approvalForm, setApprovalForm] = useState({ approved: true, comment: '' });
  const [editItem, setEditItem] = useState<TaskWithSubtasks | null>(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [plans, setPlans] = useState<SimplePlan[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    title: '', description: '', assigneeId: '', dueDate: '',
    priority: 'medium', sourceType: 'assigned', planId: '',
    strategicAlignment: false, alignmentTarget: '', parentTaskId: '',
  });
  const [progressForm, setProgressForm] = useState({ progress: 0, result: '' });
  const [subtaskForm, setSubtaskForm] = useState({ title: '', assigneeId: '', dueDate: '', priority: 'medium' });

  useEffect(() => { loadData(); loadOptions(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tasks-v2?limit=200');
      if (res.data.success) {
        // 构建树形结构
        const allTasks = res.data.data?.items || [];
        const taskMap = new Map<string, TaskWithSubtasks>(allTasks.map((t: any) => [t.id, { ...t, subTasks: [] as TaskWithSubtasks[] }]));
        const rootTasks: TaskWithSubtasks[] = [];
        allTasks.forEach((t: any) => {
          const task = taskMap.get(t.id)!;
          if (t.parentTaskId && taskMap.has(t.parentTaskId)) {
            taskMap.get(t.parentTaskId)!.subTasks!.push(task);
          } else {
            rootTasks.push(task);
          }
        });
        setList(rootTasks);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadOptions = async () => {
    try {
      const [uRes, pRes] = await Promise.all([
        apiClient.get('/users?limit=100'),
        apiClient.get('/plans?limit=100'),
      ]);
      if (uRes.data.success) setUsers(uRes.data.data?.items || []);
      if (pRes.data.success) setPlans(pRes.data.data?.items || []);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.dueDate) { alert('请填写任务名称和截止日期'); return; }
    try {
      setSaving(true);
      const body: any = { ...form, assigneeId: form.assigneeId || null, planId: form.planId || null, parentTaskId: form.parentTaskId || null };
      if (editItem) { await apiClient.put(`/tasks-v2/${editItem.id}`, body); }
      else { await apiClient.post('/tasks-v2', body); }
      setShowDialog(false); resetForm(); loadData();
    } catch (err: any) { alert(err.response?.data?.error || '操作失败'); }
    finally { setSaving(false); }
  };

  const handleSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskForm.title.trim() || !subtaskForm.dueDate || !showSubtask) return;
    try {
      setSaving(true);
      await apiClient.post('/tasks-v2', {
        ...subtaskForm,
        parentTaskId: showSubtask.id,
        sourceType: 'assigned',
        planId: (showSubtask as any).planId || null,
      });
      setShowSubtask(null); setSubtaskForm({ title: '', assigneeId: '', dueDate: '', priority: 'medium' }); loadData();
    } catch (err: any) { alert(err.response?.data?.error || '创建失败'); }
    finally { setSaving(false); }
  };

  const onEdit = (item: TaskWithSubtasks) => {
    setEditItem(item);
    setForm({
      title: item.title, description: item.description || '',
      assigneeId: item.assignee?.id || '', dueDate: item.dueDate.split('T')[0],
      priority: item.priority,
      sourceType: (item as any).sourceType || 'assigned',
      planId: (item as any).planId || '',
      strategicAlignment: (item as any).strategicAlignment || false,
      alignmentTarget: (item as any).alignmentTarget || '',
      parentTaskId: (item as any).parentTaskId || '',
    });
    setShowDialog(true);
  };

  const onDelete = async (id: string) => {
    if (!confirm('确定删除此任务？子任务也会一并删除。')) return;
    try { await apiClient.delete(`/tasks-v2/${id}`); loadData(); }
    catch (err: any) { alert(err.response?.data?.error || '删除失败'); }
  };

  const onViewDetail = async (item: TaskWithSubtasks) => {
    try {
      const res = await apiClient.get(`/tasks-v2/${item.id}`);
      if (res.data.success) setShowDetail(res.data.data);
    } catch (e) { console.error(e); }
  };

  const openProgress = (item: TaskWithSubtasks) => {
    setShowProgress(item);
    setProgressForm({ progress: item.progress || 0, result: '' });
  };

  const submitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showProgress) return;
    try {
      await apiClient.put(`/tasks-v2/${showProgress.id}/progress`, progressForm);
      setShowProgress(null); loadData();
    } catch (err: any) { alert(err.response?.data?.error || '操作失败'); }
  };

  const confirmTask = async (id: string) => {
    try { await apiClient.post(`/tasks-v2/${id}/confirm`); loadData(); }
    catch (err: any) { alert(err.response?.data?.error || '操作失败'); }
  };

  // 提交审核
  const submitForApproval = async (item: TaskWithSubtasks) => {
    if (!confirm('确定提交此任务进行审核？')) return;
    try {
      await apiClient.put(`/tasks-v2/${item.id}`, { status: 'pending_approval' });
      loadData();
    } catch (err: any) { alert(err.response?.data?.error || '提交失败'); }
  };

  // 审核任务
  const handleApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showApproval) return;
    try {
      await apiClient.post(`/tasks-v2/${showApproval.id}/approve`, approvalForm);
      setShowApproval(null);
      setApprovalForm({ approved: true, comment: '' });
      loadData();
    } catch (err: any) { alert(err.response?.data?.error || '审核失败'); }
  };

  const resetForm = () => {
    setEditItem(null);
    setForm({ title: '', description: '', assigneeId: '', dueDate: '', priority: 'medium', sourceType: 'assigned', planId: '', strategicAlignment: false, alignmentTarget: '', parentTaskId: '' });
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedTasks(newExpanded);
  };

  const priorityMap: Record<string, { label: string; class: string }> = {
    low: { label: '低', class: 'bg-gray-100 text-gray-700' },
    medium: { label: '中', class: 'bg-blue-100 text-blue-700' },
    high: { label: '高', class: 'bg-orange-100 text-orange-700' },
    urgent: { label: '紧急', class: 'bg-red-100 text-red-700' },
  };
  const statusMap: Record<string, { label: string; class: string }> = {
    pending: { label: '待确认', class: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: '已确认', class: 'bg-blue-100 text-blue-700' },
    in_progress: { label: '进行中', class: 'bg-cyan-100 text-cyan-700' },
    completed: { label: '已完成', class: 'bg-green-100 text-green-700' },
    pending_approval: { label: '待审核', class: 'bg-purple-100 text-purple-700' },
    approved: { label: '已通过', class: 'bg-green-200 text-green-800' },
    rejected: { label: '已驳回', class: 'bg-red-100 text-red-700' },
    verified: { label: '已验收', class: 'bg-green-200 text-green-800' },
  };
  const sourceMap: Record<string, string> = { assigned: '上级分配', self_initiated: '主动申请', plan_decomposition: '计划分解' };

  // 递归渲染任务行
  const renderTaskRow = (item: TaskWithSubtasks, level: number = 0) => {
    const hasSubtasks = item.subTasks && item.subTasks.length > 0;
    const isExpanded = expandedTasks.has(item.id);
    const t = item as any;

    return (
      <React.Fragment key={item.id}>
        <TableRow>
          <TableCell>
            <div className="flex items-center gap-2" style={{ paddingLeft: level * 24 }}>
              {hasSubtasks ? (
                <button onClick={() => toggleExpand(item.id)} className="p-0.5 hover:bg-muted rounded">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              ) : <div className="w-5" />}
              {level > 0 && <GitBranch className="w-3 h-3 text-muted-foreground" />}
              <span className="font-medium">{item.title}</span>
              {hasSubtasks && <Badge variant="outline" className="text-xs">{item.subTasks!.length}个子任务</Badge>}
            </div>
          </TableCell>
          <TableCell><Badge variant="outline">{sourceMap[t.sourceType] || t.sourceType || '-'}</Badge></TableCell>
          <TableCell><div className="flex items-center gap-1"><User className="w-3 h-3" />{item.assignee?.name || '-'}</div></TableCell>
          <TableCell><div className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.dueDate?.split('T')[0] || '-'}</div></TableCell>
          <TableCell><Badge className={priorityMap[item.priority]?.class || ''}>{priorityMap[item.priority]?.label}</Badge></TableCell>
          <TableCell><Badge className={statusMap[item.status]?.class || ''}>{statusMap[item.status]?.label || item.status}</Badge></TableCell>
          <TableCell><div className="flex items-center gap-1"><Progress value={item.progress || 0} className="w-12 h-1.5" /><span className="text-xs">{item.progress || 0}%</span></div></TableCell>
          <TableCell>
            {item.status === 'pending' && <Button variant="ghost" size="sm" onClick={() => confirmTask(item.id)} title="确认任务"><CheckCircle className="w-4 h-4 text-green-500" /></Button>}
            {item.status === 'in_progress' && <Button variant="ghost" size="sm" onClick={() => openProgress(item)} title="更新进度"><Edit className="w-4 h-4" /></Button>}
            {item.status === 'completed' && (item as any).assigneeId === user?.id && <Button variant="ghost" size="sm" onClick={() => submitForApproval(item)} title="提交审核"><Send className="w-4 h-4 text-purple-500" /></Button>}
            {item.status === 'pending_approval' && isAdmin() && <Button variant="ghost" size="sm" onClick={() => setShowApproval(item)} title="审核"><ThumbsUp className="w-4 h-4 text-blue-500" /></Button>}
            {hasPermission('task:create') && <Button variant="ghost" size="sm" onClick={() => { setShowSubtask(item); setSubtaskForm({ ...subtaskForm, dueDate: item.dueDate.split('T')[0] }); }} title="添加子任务"><Plus className="w-4 h-4" /></Button>}
            <Button variant="ghost" size="sm" onClick={() => onViewDetail(item)} title="查看详情"><Eye className="w-4 h-4" /></Button>
            {canEditContent((item as any).assignerId || '', 'task') && <Button variant="ghost" size="sm" onClick={() => onEdit(item)} title="编辑"><Edit className="w-4 h-4" /></Button>}
            {canDeleteContent((item as any).assignerId || '', 'task') && <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)} title="删除"><Trash2 className="w-4 h-4 text-destructive" /></Button>}
          </TableCell>
        </TableRow>
        {hasSubtasks && isExpanded && item.subTasks!.map(sub => renderTaskRow(sub, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl">任务管理</h1>
            <p className="text-muted-foreground text-sm">支持子任务分解，点击展开查看子任务</p>
          </div>
          <Button onClick={() => { resetForm(); setShowDialog(true); }} disabled={!hasPermission('task:create')}><Plus className="w-4 h-4 mr-2" />新建任务</Button>
        </div>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardContent className="pt-6">
            {loading ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
              : list.length === 0 ? <div className="text-center py-12 text-muted-foreground">暂无任务，请新建任务</div>
                : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead><TableHead>来源</TableHead><TableHead>执行人</TableHead>
                        <TableHead>截止日期</TableHead><TableHead>优先级</TableHead><TableHead>状态</TableHead><TableHead>进度</TableHead><TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>{list.map(item => renderTaskRow(item))}</TableBody>
                  </Table>
                )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* 新建/编辑对话框 */}
      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? '编辑任务' : '下达新任务'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>任务名称 *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="space-y-2"><Label>任务描述</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>执行人</Label>
                <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">-- 选择 --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>截止日期 *</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} required /></div>
              <div className="space-y-2"><Label>优先级</Label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="urgent">紧急</option>
                </select>
              </div>
              <div className="space-y-2"><Label>关联计划</Label>
                <select value={form.planId} onChange={e => { const p = plans.find(x => x.id === e.target.value); setForm({ ...form, planId: e.target.value, strategicAlignment: !!e.target.value, alignmentTarget: p?.strategy?.title || '' }); }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">-- 不关联 --</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </div>
            {form.strategicAlignment && <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded"><Link2 className="w-4 h-4" />已对齐战略</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={saving}>{saving ? '提交中...' : (editItem ? '保存' : '创建')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 添加子任务对话框 */}
      <Dialog open={!!showSubtask} onOpenChange={() => setShowSubtask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加子任务 - {showSubtask?.title}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubtask} className="space-y-4">
            <div className="space-y-2"><Label>子任务名称 *</Label><Input value={subtaskForm.title} onChange={e => setSubtaskForm({ ...subtaskForm, title: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>执行人</Label>
                <select value={subtaskForm.assigneeId} onChange={e => setSubtaskForm({ ...subtaskForm, assigneeId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">-- 选择 --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>截止日期 *</Label><Input type="date" value={subtaskForm.dueDate} onChange={e => setSubtaskForm({ ...subtaskForm, dueDate: e.target.value })} required /></div>
              <div className="space-y-2"><Label>优先级</Label>
                <select value={subtaskForm.priority} onChange={e => setSubtaskForm({ ...subtaskForm, priority: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="urgent">紧急</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSubtask(null)}>取消</Button>
              <Button type="submit" disabled={saving}>{saving ? '创建中...' : '创建子任务'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 更新进度对话框 */}
      <Dialog open={!!showProgress} onOpenChange={() => setShowProgress(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>更新任务进度</DialogTitle></DialogHeader>
          <div className="space-y-2 mb-4">
            <p className="font-medium">{showProgress?.title}</p>
            <p className="text-sm text-muted-foreground">当前进度：{showProgress?.progress || 0}%</p>
          </div>
          <form onSubmit={submitProgress} className="space-y-4">
            <div className="space-y-2"><Label>新进度 (%)</Label><Input type="number" min={0} max={100} value={progressForm.progress} onChange={e => setProgressForm({ ...progressForm, progress: parseInt(e.target.value) || 0 })} /></div>
            <div className="space-y-2"><Label>执行描述 *</Label><Textarea value={progressForm.result} onChange={e => setProgressForm({ ...progressForm, result: e.target.value })} rows={3} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowProgress(null)}>取消</Button>
              <Button type="submit">更新进度</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 任务详情对话框 */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{showDetail?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">来源：</span>{sourceMap[(showDetail as any)?.sourceType] || '-'}</div>
              <div><span className="text-muted-foreground">优先级：</span>{priorityMap[showDetail?.priority || '']?.label}</div>
              <div><span className="text-muted-foreground">执行人：</span>{showDetail?.assignee?.name || '-'}</div>
              <div><span className="text-muted-foreground">截止日期：</span>{showDetail?.dueDate?.split('T')[0]}</div>
              <div><span className="text-muted-foreground">状态：</span><Badge className={statusMap[showDetail?.status || '']?.class || ''}>{statusMap[showDetail?.status || '']?.label}</Badge></div>
              <div><span className="text-muted-foreground">进度：</span>{showDetail?.progress || 0}%</div>
            </div>
            {showDetail?.description && <div><span className="text-muted-foreground">描述：</span><p className="mt-1">{showDetail.description}</p></div>}
            {showDetail?.subTasks && showDetail.subTasks.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">子任务 ({showDetail.subTasks.length})</h4>
                <div className="space-y-2">
                  {showDetail.subTasks.map(st => (
                    <div key={st.id} className="flex items-center justify-between p-2 rounded border text-sm">
                      <span>{st.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{st.assignee?.name || '-'}</span>
                        <Badge className={statusMap[st.status]?.class || ''}>{statusMap[st.status]?.label}</Badge>
                        <span>{st.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 任务审核对话框 */}
      <Dialog open={!!showApproval} onOpenChange={() => setShowApproval(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>审核任务</DialogTitle></DialogHeader>
          <div className="space-y-2 mb-4">
            <p className="font-medium">{showApproval?.title}</p>
            <p className="text-sm text-muted-foreground">执行人：{showApproval?.assignee?.name || '-'} | 进度：{showApproval?.progress || 0}%</p>
          </div>
          <form onSubmit={handleApproval} className="space-y-4">
            <div className="space-y-2">
              <Label>审核结果</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="approval" checked={approvalForm.approved} onChange={() => setApprovalForm({ ...approvalForm, approved: true })} className="w-4 h-4" />
                  <ThumbsUp className="w-4 h-4 text-green-500" /> 通过
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="approval" checked={!approvalForm.approved} onChange={() => setApprovalForm({ ...approvalForm, approved: false })} className="w-4 h-4" />
                  <ThumbsDown className="w-4 h-4 text-red-500" /> 驳回
                </label>
              </div>
            </div>
            <div className="space-y-2"><Label>审核意见</Label><Textarea value={approvalForm.comment} onChange={e => setApprovalForm({ ...approvalForm, comment: e.target.value })} rows={3} placeholder="请填写审核意见（驳回时必填）" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowApproval(null)}>取消</Button>
              <Button type="submit" className={!approvalForm.approved ? 'bg-red-500 hover:bg-red-600' : ''}>{approvalForm.approved ? '通过' : '驳回'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
