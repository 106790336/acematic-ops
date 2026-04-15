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
import { Plus, Edit, Trash2, FileText, ListTodo } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { usePermission } from '@/hooks/use-permission';
import type { WeeklyReport } from '@/types';

interface SimpleDepartment { id: string; name: string; }

export default function WeeklyReportList() {
  const { hasPermission, canEditContent, canDeleteContent } = usePermission();
  const [list, setList] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<WeeklyReport | null>(null);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<SimpleDepartment[]>([]);
  const [form, setForm] = useState({ weekDate: '', departmentId: '', completedTasks: '', keyData: '', nextWeekPlan: '', selfEvaluation: '达成' });

  useEffect(() => { loadData(); loadDepartments(); }, []);

  const loadData = async () => {
    try { setLoading(true); const res = await apiClient.get('/weekly-reports?limit=100'); if (res.data.success) setList(res.data.data?.items || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadDepartments = async () => {
    try { const res = await apiClient.get('/departments/list'); if (res.data.success) setDepartments(res.data.data || []); }
    catch (e) { console.error(e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.weekDate || !form.departmentId || !form.completedTasks) { alert('请填写必填项'); return; }
    try {
      setSaving(true);
      if (editItem) { await apiClient.put(`/weekly-reports/${editItem.id}`, form); }
      else { await apiClient.post('/weekly-reports', form); }
      setShowDialog(false); resetForm();
      const res = await apiClient.get('/weekly-reports?limit=100'); if (res.data.success) setList(res.data.data?.items || []);
    } catch (err: any) { alert(err.response?.data?.error || '操作失败'); }
    finally { setSaving(false); }
  };

  const onEdit = (item: WeeklyReport) => {
    setEditItem(item);
    setForm({
      weekDate: item.weekDate.split('T')[0], departmentId: item.departmentId,
      completedTasks: item.completedTasks, keyData: item.keyData,
      nextWeekPlan: item.nextWeekPlan, selfEvaluation: item.selfEvaluation,
    });
    setShowDialog(true);
  };

  const onDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    try { await apiClient.delete(`/weekly-reports/${id}`); const res = await apiClient.get('/weekly-reports?limit=100'); if (res.data.success) setList(res.data.data?.items || []); }
    catch (err: any) { alert(err.response?.data?.error || '删除失败'); }
  };

  const resetForm = () => { setEditItem(null); setForm({ weekDate: '', departmentId: '', completedTasks: '', keyData: '', nextWeekPlan: '', selfEvaluation: '达成' }); setTaskSummary([]); };
  const openCreate = () => { resetForm(); setShowDialog(true); };
  const onDialogChange = (open: boolean) => { setShowDialog(open); if (!open) resetForm(); };

  // 拉取任务汇总
  const [taskSummary, setTaskSummary] = useState<any[]>([]);
  const pullTaskSummary = async () => {
    if (!form.weekDate || !form.departmentId) { alert('请先选择日期和部门'); return; }
    try {
      const weekDate = new Date(form.weekDate);
      const startDate = new Date(weekDate);
      startDate.setDate(startDate.getDate() - 7);
      const res = await apiClient.get(`/tasks-v2?departmentId=${form.departmentId}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${form.weekDate}&limit=100`);
      if (res.data.success) {
        const tasks = res.data.data?.items || [];
        setTaskSummary(tasks);
        const completedTasks = tasks.filter((t: any) => t.status === 'completed' || t.progress >= 100);
        const summary = completedTasks.map((t: any) => `• ${t.title} (${t.progress}%)`).join('\n');
        if (summary) setForm(f => ({ ...f, completedTasks: f.completedTasks ? f.completedTasks + '\n\n--- 自动拉取 ---\n' + summary : summary }));
      }
    } catch (e) { console.error(e); }
  };

  const evalMap: Record<string, string> = { '超预期': 'bg-green-100 text-green-700', '达成': 'bg-blue-100 text-blue-700', '未达成': 'bg-red-100 text-red-700' };
  const deptName = (id: string) => departments.find(d => d.id === id)?.name || '-';

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div><h1 className="font-bold text-2xl">周报管理</h1><p className="text-muted-foreground text-sm">部门周报提交与汇总</p></div>
          <Button onClick={openCreate} disabled={!hasPermission('report:create')}><Plus className="w-4 h-4 mr-2" />提交周报</Button>
        </div>
      </FadeIn>
      <FadeIn>
        <Card>
          <CardContent className="pt-6">
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
            : list.length === 0 ? <div className="text-center py-12 text-muted-foreground">暂无数据</div>
            : (
              <Table>
                <TableHeader><TableRow><TableHead>部门</TableHead><TableHead>周次</TableHead><TableHead>完成事项</TableHead><TableHead>自评</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {list.map(item => (
                    <TableRow key={item.id}>
                      <TableCell><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /><span>{deptName(item.departmentId)}</span></div></TableCell>
                      <TableCell>{item.weekDate?.split('T')[0]}</TableCell>
                      <TableCell><span className="line-clamp-1 text-sm">{item.completedTasks}</span></TableCell>
                      <TableCell><Badge className={evalMap[item.selfEvaluation] || ''}>{item.selfEvaluation}</Badge></TableCell>
                      <TableCell>
                        {canEditContent((item as any).submitterId || '', 'report') && <Button variant="ghost" size="sm" onClick={() => onEdit(item)}><Edit className="w-4 h-4" /></Button>}
                        {canDeleteContent((item as any).submitterId || '', 'report') && <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>
      <Dialog open={showDialog} onOpenChange={onDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? '编辑周报' : '提交周报'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>周报日期 *</Label>
                <Input type="date" value={form.weekDate} onChange={e => setForm({...form, weekDate: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>所属部门 *</Label>
                <select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" required>
                  <option value="">-- 选择部门 --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>完成事项 *</Label>
                <Button type="button" variant="outline" size="sm" onClick={pullTaskSummary} disabled={!form.weekDate || !form.departmentId}>
                  <ListTodo className="w-3 h-3 mr-1" />拉取任务汇总
                </Button>
              </div>
              <Textarea value={form.completedTasks} onChange={e => setForm({...form, completedTasks: e.target.value})} rows={4} placeholder="本周完成的主要工作，点击“拉取任务汇总”自动填充" required />
              {taskSummary.length > 0 && <div className="text-xs text-muted-foreground">已拉取 {taskSummary.length} 条任务</div>}
            </div>
            <div className="space-y-2"><Label>关键数据</Label><Input value={form.keyData} onChange={e => setForm({...form, keyData: e.target.value})} placeholder="本周关键数据指标" /></div>
            <div className="space-y-2"><Label>下周计划</Label><Textarea value={form.nextWeekPlan} onChange={e => setForm({...form, nextWeekPlan: e.target.value})} rows={2} /></div>
            <div className="space-y-2">
              <Label>自评</Label>
              <select value={form.selfEvaluation} onChange={e => setForm({...form, selfEvaluation: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="超预期">超预期</option><option value="达成">达成</option><option value="未达成">未达成</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={saving}>{saving ? '提交中...' : (editItem ? '保存' : '提交')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
