import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FadeIn } from '@/components/MotionPrimitives';
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, Users, Building2 } from 'lucide-react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { usePermission } from '@/hooks/use-permission';

interface DeptNode {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
  managerId: string | null;
  memberCount: number;
  manager: { id: string; name: string } | null;
  children: DeptNode[];
}

export default function DepartmentList() {
  const { hasPermission } = usePermission();
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [flatList, setFlatList] = useState<DeptNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<DeptNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: '', parentId: '', managerId: '', description: '' });
  const [userList, setUserList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { loadData(); loadUsers(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [treeRes, flatRes] = await Promise.all([
        apiClient.get('/departments'),
        apiClient.get('/departments/list'),
      ]);
      if (treeRes.data.success) setTree(treeRes.data.data);
      if (flatRes.data.success) setFlatList(flatRes.data.data);
      // 默认展开所有
      setExpanded(new Set(flatRes.data.data.map((d: any) => d.id)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try {
      const res = await apiClient.get('/users?limit=100');
      if (res.data.success) setUserList(res.data.data?.items || []);
    } catch (e) { console.error(e); }
  };

  const toggle = (id: string) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  const openCreate = (parentId?: string, parentName?: string) => {
    setEditItem(null);
    setForm({ name: '', parentId: parentId || '', managerId: '', description: parentName ? `隶属${parentName}` : '' });
    setShowDialog(true);
  };

  const onEdit = (item: DeptNode) => {
    setEditItem(item);
    setForm({ name: item.name, parentId: item.parentId || '', managerId: item.managerId || '', description: item.description || '' });
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setSaving(true);
      const body: any = {
        name: form.name,
        parentId: form.parentId || null,
        managerId: form.managerId || null,
        description: form.description || null,
      };
      if (editItem) await apiClient.put(`/departments/${editItem.id}`, body);
      else await apiClient.post('/departments', body);
      setShowDialog(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || getErrorMessage(err));
    } finally { setSaving(false); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('确定删除该部门？')) return;
    try {
      await apiClient.delete(`/departments/${id}`);
      loadData();
    } catch (err: any) { alert(err.response?.data?.error || getErrorMessage(err)); }
  };

  const getLevelBadge = (level: number) => {
    if (level === 0) return <Badge className="bg-purple-100 text-purple-700">一级</Badge>;
    if (level === 1) return <Badge className="bg-blue-100 text-blue-700">二级</Badge>;
    return <Badge className="bg-cyan-100 text-cyan-700">三级</Badge>;
  };

  const renderNode = (node: DeptNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 border-b"
          style={{ paddingLeft: level * 28 + 12 }}
        >
          {hasChildren ? (
            <button onClick={() => toggle(node.id)} className="p-0.5 hover:bg-muted rounded">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <Building2 className="w-4 h-4 text-muted-foreground" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{node.name}</span>
              {getLevelBadge(level)}
            </div>
            {node.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{node.description}</div>}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {node.manager && <Badge variant="outline" className="text-xs">{node.manager.name}</Badge>}
            <div className="flex items-center gap-1"><Users className="w-3 h-3" />{node.memberCount}</div>
          </div>

          <div className="flex items-center gap-1">
            {hasPermission('department:create') && <Button variant="ghost" size="sm" onClick={() => openCreate(node.id, node.name)} title="添加子部门">
              <Plus className="w-4 h-4" />
            </Button>}
            {hasPermission('department:edit') && <Button variant="ghost" size="sm" onClick={() => onEdit(node)}><Edit className="w-4 h-4" /></Button>}
            {hasPermission('department:delete') && <Button variant="ghost" size="sm" onClick={() => onDelete(node.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
          </div>
        </div>
        {hasChildren && isExpanded && node.children.map(child => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl">组织架构</h1>
            <p className="text-muted-foreground text-sm">三级树形结构管理</p>
          </div>
          <Button onClick={() => openCreate()} disabled={!hasPermission('department:create')}><Plus className="w-4 h-4 mr-2" />新建一级部门</Button>
        </div>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
            ) : tree.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">暂无部门</div>
            ) : (
              <div className="space-y-0">{tree.map(node => renderNode(node))}</div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? '编辑部门' : (form.parentId ? '新建子部门' : '新建一级部门')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>部门名称 *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            {!editItem && (
              <div className="space-y-2">
                <Label>上级部门</Label>
                <select value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">无（一级部门）</option>
                  {/* @ts-ignore */}
                  {flatList.filter((d: DeptNode) => d.id !== (editItem ? editItem.id : '')).map((d: DeptNode) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>部门负责人</Label>
              <select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="">-- 选择 --</option>
                {userList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label>描述</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
