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
import { Plus, Edit, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Issue } from '@/types';
import { usePermission } from '@/hooks/use-permission';

export default function IssueList() {
  const { hasPermission } = usePermission();
  const [list, setList] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<Issue | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ source: '周报', discoveryDate: '', departmentId: '', description: '', issueType: '质量问题', severity: '中' });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/issues?limit=100');
        if (res.data.success) setList(res.data.data?.items || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.discoveryDate || !form.description) { alert('请填写必填项'); return; }
    try {
      setSaving(true);
      if (editItem) {
        await apiClient.put(`/issues/${editItem.id}`, form);
      } else {
        await apiClient.post('/issues', form);
      }
      setShowDialog(false); resetForm();
      const res = await apiClient.get('/issues?limit=100');
      if (res.data.success) setList(res.data.data?.items || []);
    } catch (err: any) { alert(err.response?.data?.error || '操作失败'); }
    finally { setSaving(false); }
  };

  const onEdit = (item: Issue) => {
    setEditItem(item);
    setForm({
      source: item.source,
      discoveryDate: item.discoveryDate.split('T')[0],
      departmentId: item.departmentId,
      description: item.description,
      issueType: item.issueType,
      severity: item.severity,
    });
    setShowDialog(true);
  };

  const onDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    try { await apiClient.delete(`/issues/${id}`);
      const res = await apiClient.get('/issues?limit=100');
      if (res.data.success) setList(res.data.data?.items || []);
    } catch (err: any) { alert(err.response?.data?.error || '删除失败'); }
  };

  const resetForm = () => { setEditItem(null); setForm({ source: '周报', discoveryDate: '', departmentId: '', description: '', issueType: '质量问题', severity: '中' }); };
  const openCreate = () => { resetForm(); setShowDialog(true); };
  const onDialogChange = (open: boolean) => { setShowDialog(open); if (!open) resetForm(); };

  const severityMap: Record<string, string> = { 高: 'bg-red-100 text-red-700', 中: 'bg-yellow-100 text-yellow-700', 低: 'bg-green-100 text-green-700' };
  const statusMap: Record<string, string> = { '待处理': 'bg-red-100 text-red-700', '处理中': 'bg-blue-100 text-blue-700', '已解决': 'bg-green-100 text-green-700' };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div><h1 className="font-bold text-2xl">问题清单</h1><p className="text-muted-foreground text-sm">问题跟踪管理</p></div>
          <Button onClick={openCreate} disabled={!hasPermission('issue:create')}><Plus className="w-4 h-4 mr-2" />新建问题</Button>
        </div>
      </FadeIn>
      <FadeIn>
        <Card>
          <CardContent className="pt-6">
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
            : list.length === 0 ? <div className="text-center py-12 text-muted-foreground">暂无数据</div>
            : (
              <Table>
                <TableHeader><TableRow><TableHead>描述</TableHead><TableHead>类型</TableHead><TableHead>严重程度</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {list.map(item => (
                    <TableRow key={item.id}>
                      <TableCell><span className="font-medium">{item.description}</span></TableCell>
                      <TableCell><Badge variant="outline">{item.issueType}</Badge></TableCell>
                      <TableCell><Badge className={severityMap[item.severity] || ''}>{item.severity}</Badge></TableCell>
                      <TableCell><Badge className={statusMap[item.status] || ''}>{item.status}</Badge></TableCell>
                      <TableCell>
                        {hasPermission('issue:edit') && <Button variant="ghost" size="sm" onClick={() => onEdit(item)}><Edit className="w-4 h-4" /></Button>}
                        {hasPermission('issue:delete') && <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? '编辑问题' : '新建问题'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>问题描述 *</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>发现日期 *</Label><Input type="date" value={form.discoveryDate} onChange={e => setForm({...form, discoveryDate: e.target.value})} required /></div>
              <div className="space-y-2"><Label>类型</Label><Input value={form.issueType} onChange={e => setForm({...form, issueType: e.target.value})} /></div>
              <div className="space-y-2"><Label>严重程度</Label><Input value={form.severity} onChange={e => setForm({...form, severity: e.target.value})} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={saving}>{saving ? '提交中...' : (editItem ? '保存' : '创建')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
