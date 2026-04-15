import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FadeIn } from '@/components/MotionPrimitives';
import { Plus, Edit, Trash2, Link, Eye, Send, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { usePermission } from '@/hooks/use-permission';
import type { Plan } from '@/types';
import { toast } from 'sonner';

interface SimpleStrategy { id: string; title: string; status: string; }
interface SimpleDepartment { id: string; name: string; }
interface SimpleTask { id: string; title: string; status: string; assignee?: { name: string }; }

export default function PlanList() {
  const { hasPermission, isAdmin, user } = usePermission();
  const [list, setList] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetail, setShowDetail] = useState<Plan | null>(null);
  const [showReview, setShowReview] = useState<Plan | null>(null);
  const [editItem, setEditItem] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [strategies, setStrategies] = useState<SimpleStrategy[]>([]);
  const [departments, setDepartments] = useState<SimpleDepartment[]>([]);
  const [relatedTasks, setRelatedTasks] = useState<SimpleTask[]>([]);
  const [reviewForm, setReviewForm] = useState({ approved: true, comment: '' });
  const [form, setForm] = useState({
    title: '', description: '', type: 'department',
    strategyId: '', departmentId: '', priority: 'medium',
    startDate: '', endDate: '',
  });

  useEffect(() => { loadData(); loadOptions(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/plans?limit=100');
      if (res.data.success) setList(res.data.data?.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadOptions = async () => {
    try {
      const [sRes, dRes] = await Promise.all([
        apiClient.get('/strategies?limit=100'),
        apiClient.get('/departments/list'),
      ]);
      if (sRes.data.success) setStrategies(sRes.data.data?.items || []);
      if (dRes.data.success) setDepartments(dRes.data.data || []);
    } catch (e) { console.error(e); }
  };

  const loadRelatedTasks = async (planId: string) => {
    try {
      const res = await apiClient.get(`/plans/${planId}`);
      if (res.data.success && res.data.data.tasks) setRelatedTasks(res.data.data.tasks);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startDate || !form.endDate) { alert('请填写必填项'); return; }
    try {
      setSaving(true);
      const body: any = { ...form, strategyId: form.strategyId || null, departmentId: form.departmentId || null };
      if (editItem) {
        await apiClient.put(`/plans/${editItem.id}`, body);
      } else {
        await apiClient.post('/plans', body);
      }
      setShowDialog(false); resetForm();
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.error || '操作失败'); }
    finally { setSaving(false); }
  };

  const onEdit = (item: Plan) => {
    if (item.status !== 'draft') { alert('只有草稿状态可以编辑'); return; }
    setEditItem(item);
    setForm({
      title: item.title, description: item.description || '', type: item.type,
      strategyId: item.strategyId || '', departmentId: item.departmentId || '',
      priority: item.priority,
      startDate: item.startDate.split('T')[0], endDate: item.endDate.split('T')[0],
    });
    setShowDialog(true);
  };

  const onDelete = async (id: string) => {
    const item = list.find(p => p.id === id);
    if (item?.status !== 'draft') { alert('只有草稿状态可以删除'); return; }
    if (!confirm('确定删除此计划草稿？')) return;
    try {
      await apiClient.delete(`/plans/${id}`);
      loadData();
      toast.success('删除成功');
    } catch (err: any) { toast.error(err.response?.data?.error || '删除失败'); }
  };

  const onSubmit = async (id: string) => {
    if (!confirm('确定提交审核？提交后将无法修改。')) return;
    try {
      await apiClient.post(`/plans/${id}/submit`);
      loadData();
      toast.success('已提交审核');
    } catch (err: any) { toast.error(err.response?.data?.error || '提交失败'); }
  };

  const onWithdraw = async (id: string) => {
    if (!confirm('确定撤回审核？')) return;
    try {
      await apiClient.post(`/plans/${id}/withdraw`);
      loadData();
      toast.success('已撤回');
    } catch (err: any) { toast.error(err.response?.data?.error || '撤回失败'); }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReview) return;
    try {
      await apiClient.post(`/plans/${showReview.id}/review`, reviewForm);
      setShowReview(null);
      setReviewForm({ approved: true, comment: '' });
      loadData();
      toast.success(reviewForm.approved ? '审核通过' : '已驳回');
    } catch (err: any) { toast.error(err.response?.data?.error || '审核失败'); }
  };

  const onViewDetail = (item: Plan) => { setShowDetail(item); loadRelatedTasks(item.id); };

  const resetForm = () => {
    setEditItem(null);
    setForm({ title: '', description: '', type: 'department', strategyId: '', departmentId: '', priority: 'medium', startDate: '', endDate: '' });
  };

  const openCreate = () => { resetForm(); setShowDialog(true); };
  const onDialogChange = (open: boolean) => { setShowDialog(open); if (!open) resetForm(); };

  const typeMap: Record<string, string> = { company: '公司计划', department: '部门计划', personal: '个人计划' };
  const statusMap: Record<string, { label: string; class: string }> = {
    draft: { label: '草稿', class: 'bg-gray-100 text-gray-700' },
    pending: { label: '待审核', class: 'bg-yellow-100 text-yellow-700' },
    active: { label: '生效中', class: 'bg-blue-100 text-blue-700' },
    completed: { label: '已完成', class: 'bg-green-100 text-green-700' },
    cancelled: { label: '已取消', class: 'bg-red-100 text-red-700' },
  };
  const prioMap: Record<string, { label: string; class: string }> = {
    high: { label: '高', class: 'bg-red-100 text-red-700' },
    medium: { label: '中', class: 'bg-yellow-100 text-yellow-700' },
    low: { label: '低', class: 'bg-green-100 text-green-700' },
  };

  const strategyName = (id: string) => strategies.find(s => s.id === id)?.title || '-';

  const canCreatePlan = hasPermission('plan:create');
  const isCEO = user?.role === 'ceo';
  const isExecutive = user?.role === 'executive';
  const isManager = user?.role === 'manager';

  const canEdit = (item: Plan) => {
    if (!canCreatePlan) return false;
    if (item.status !== 'draft') return false;
    return item.ownerId === user?.id || isAdmin();
  };

  const canDelete = (item: Plan) => {
    if (!canCreatePlan) return false;
    if (item.status !== 'draft') return false;
    return item.ownerId === user?.id || isCEO;
  };

  const canSubmit = (item: Plan) => item.status === 'draft' && item.ownerId === user?.id;

  const canWithdraw = (item: Plan) => item.status === 'pending' && (item as any).submittedById === user?.id;

  const canReview = (item: Plan) => {
    if (item.status !== 'pending') return false;
    if (item.type === 'company') return isCEO;
    if (item.type === 'department') return isCEO || isExecutive;
    if (item.type === 'personal') return isCEO || isExecutive || isManager;
    return false;
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl">计划管理</h1>
            <p className="text-muted-foreground text-sm">草稿 → 审核 → 生效，生效后需变更申请才能修改</p>
          </div>
          {canCreatePlan && <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />新建计划</Button>}
        </div>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardContent className="pt-6">
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
            : list.length === 0 ? <div className="text-center py-12 text-muted-foreground">暂无计划</div>
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>关联战略</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>进度</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2"><Link className="w-4 h-4 text-blue-500" /><span className="font-medium">{item.title}</span></div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{typeMap[item.type] || item.type}</Badge></TableCell>
                      <TableCell><Badge className={statusMap[item.status]?.class || ''}>{statusMap[item.status]?.label || item.status}</Badge></TableCell>
                      <TableCell><span className="text-sm">{item.strategy ? item.strategy.title : <span className="text-muted-foreground">未关联</span>}</span></TableCell>
                      <TableCell><span className="text-sm">{item.department?.name || '-'}</span></TableCell>
                      <TableCell><Badge className={prioMap[item.priority]?.class || ''}>{prioMap[item.priority]?.label || item.priority}</Badge></TableCell>
                      <TableCell><span className="text-sm">{item.progress || 0}%</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canSubmit(item) && <Button variant="ghost" size="sm" onClick={() => onSubmit(item.id)} title="提交审核"><Send className="w-4 h-4 text-yellow-500" /></Button>}
                          {canWithdraw(item) && <Button variant="ghost" size="sm" onClick={() => onWithdraw(item.id)} title="撤回"><RotateCcw className="w-4 h-4 text-orange-500" /></Button>}
                          {canReview(item) && <Button variant="ghost" size="sm" onClick={() => setShowReview(item)} title="审核"><CheckCircle className="w-4 h-4 text-green-500" /></Button>}
                          <Button variant="ghost" size="sm" onClick={() => onViewDetail(item)} title="查看"><Eye className="w-4 h-4" /></Button>
                          {canEdit(item) && <Button variant="ghost" size="sm" onClick={() => onEdit(item)} title="编辑"><Edit className="w-4 h-4" /></Button>}
                          {canDelete(item) && <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)} title="删除"><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* 新建/编辑对话框 */}
      <Dialog open={showDialog} onOpenChange={onDialogChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? '编辑计划' : '新建计划（草稿）'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>计划名称 *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></div>
            <div className="space-y-2"><Label>描述</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>关联战略</Label>
                <select value={form.strategyId} onChange={e => setForm({...form, strategyId: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">-- 不关联 --</option>
                  {strategies.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>所属部门</Label>
                <select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">-- 不指定 --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>计划类型</Label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  {isCEO || isExecutive ? <option value="company">公司计划</option> : null}
                  {isCEO || isExecutive || isManager ? <option value="department">部门计划</option> : null}
                  <option value="personal">个人计划</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                </select>
              </div>
              <div className="space-y-2"><Label>开始日期 *</Label><Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required /></div>
              <div className="space-y-2"><Label>结束日期 *</Label><Input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} required /></div>
            </div>
            {form.strategyId && <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">已关联战略：{strategyName(form.strategyId)}</p>}
            <div className="text-sm text-muted-foreground">保存后将处于草稿状态，需提交审核后生效</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={saving}>{saving ? '保存中...' : '保存草稿'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 审核对话框 */}
      <Dialog open={!!showReview} onOpenChange={() => setShowReview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>审核计划</DialogTitle></DialogHeader>
          <div className="space-y-2 mb-4">
            <p className="font-medium">{showReview?.title}</p>
            <p className="text-sm text-muted-foreground">{typeMap[showReview?.type || '']} | {(showReview as any)?.owner?.name}</p>
          </div>
          <form onSubmit={handleReview} className="space-y-4">
            <div className="space-y-2">
              <Label>审核结果</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="review" checked={reviewForm.approved} onChange={() => setReviewForm({...reviewForm, approved: true})} className="w-4 h-4" />
                  <CheckCircle className="w-4 h-4 text-green-500" /> 通过
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="review" checked={!reviewForm.approved} onChange={() => setReviewForm({...reviewForm, approved: false})} className="w-4 h-4" />
                  <XCircle className="w-4 h-4 text-red-500" /> 驳回
                </label>
              </div>
            </div>
            <div className="space-y-2"><Label>审核意见</Label><Textarea value={reviewForm.comment} onChange={e => setReviewForm({...reviewForm, comment: e.target.value})} rows={3} placeholder="请填写审核意见" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowReview(null)}>取消</Button>
              <Button type="submit" className={!reviewForm.approved ? 'bg-red-500 hover:bg-red-600' : ''}>{reviewForm.approved ? '通过' : '驳回'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{showDetail?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">类型：</span>{typeMap[showDetail?.type || '']}</div>
              <div><span className="text-muted-foreground">优先级：</span>{prioMap[showDetail?.priority || '']?.label}</div>
              <div><span className="text-muted-foreground">关联战略：</span>{showDetail?.strategy?.title || '未关联'}</div>
              <div><span className="text-muted-foreground">所属部门：</span>{showDetail?.department?.name || '-'}</div>
              <div><span className="text-muted-foreground">负责人：</span>{showDetail?.owner?.name || '-'}</div>
              <div><span className="text-muted-foreground">状态：</span><Badge className={statusMap[showDetail?.status || '']?.class || ''}>{statusMap[showDetail?.status || '']?.label}</Badge></div>
            </div>
            <div>
              <h3 className="font-medium mb-2">关联任务 ({relatedTasks.length})</h3>
              {relatedTasks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">暂无关联任务</p>
              : (
                <div className="space-y-2">
                  {relatedTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                      <span>{t.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t.assignee?.name || '-'}</span>
                        <Badge variant="outline" className="text-xs">{t.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
