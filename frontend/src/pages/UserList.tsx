import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FadeIn } from '@/components/MotionPrimitives';
import { Plus, Edit, Trash2, User, ChevronRight, ChevronDown, Building2, Download, Upload, Key } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel, importFromJSON } from '@/lib/export-utils';
import { toast } from 'sonner';
import type { User as UserType } from '@/types';

interface DeptNode {
  id: string;
  name: string;
  parentId: string | null;
  children: DeptNode[];
  memberCount?: number;
}

export default function UserList() {
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermission();
  const [deptTree, setDeptTree] = useState<DeptNode[]>([]);
  const [flatDepts, setFlatDepts] = useState<DeptNode[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<UserType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'employee', departmentId: '', position: '' });

  const isAdmin = currentUser?.role === 'ceo' || currentUser?.role === 'executive';
  const canCreateUser = hasPermission('user:create');
  const canEditUser = hasPermission('user:edit');
  const canDeleteUser = hasPermission('user:delete');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [deptRes, userRes] = await Promise.all([
        apiClient.get('/departments'),
        apiClient.get('/users?limit=100'),
      ]);
      if (deptRes.data.success) {
        setDeptTree(deptRes.data.data);
        flattenDepts(deptRes.data.data, setFlatDepts);
        setExpanded(new Set(getAllDeptIds(deptRes.data.data)));
      }
      if (userRes.data.success) setUsers(userRes.data.data?.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const flattenDepts = (nodes: DeptNode[], setter: (d: DeptNode[]) => void) => {
    const result: DeptNode[] = [];
    const walk = (n: DeptNode[]) => { n.forEach(d => { result.push(d); if (d.children?.length) walk(d.children); }); };
    walk(nodes);
    setter(result);
  };

  const getAllDeptIds = (nodes: DeptNode[]): string[] => {
    const ids: string[] = [];
    const walk = (n: DeptNode[]) => { n.forEach(d => { ids.push(d.id); if (d.children?.length) walk(d.children); }); };
    walk(nodes);
    return ids;
  };

  const toggle = (id: string) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  const getUsersByDept = (deptId: string) => users.filter(u => u.departmentId === deptId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim()) { alert('请填写必填项'); return; }
    try {
      setSaving(true);
      if (editItem) {
        const { password, ...rest } = form;
        await apiClient.put(`/users/${editItem.id}`, password ? form : rest);
      } else {
        await apiClient.post('/auth/register', form);
      }
      setShowDialog(false); resetForm();
      loadData();
    } catch (err: any) { alert(err.response?.data?.error || '操作失败'); }
    finally { setSaving(false); }
  };

  const onEdit = (item: UserType, deptId?: string) => {
    setEditItem(item);
    setForm({ name: item.name, username: item.username, password: '', role: item.role, departmentId: deptId || item.departmentId || '', position: item.position || '' });
    setShowDialog(true);
  };

  const onDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    try {
      await apiClient.delete(`/users/${id}`);
      loadData();
    } catch (err: any) { alert(err.response?.data?.error || '删除失败'); }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`确定要将 ${userName} 的密码重置为 123456 吗？`)) return;
    try {
      await apiClient.post(`/users/${userId}/reset-password`);
      toast.success('密码已重置为 123456');
    } catch (err: any) {
      toast.error(err.response?.data?.error || '重置失败');
    }
  };

  const handleExport = async () => {
    try {
      const res = await apiClient.get('/users/export/all');
      if (res.data.success) {
        const data = res.data.data.map((u: any) => ({
          用户名: u.username,
          姓名: u.name,
          角色: u.role,
          部门: u.department?.name || '',
          职位: u.position || '',
          邮箱: u.email || '',
          电话: u.phone || '',
          状态: u.isActive ? '正常' : '禁用',
        }));
        exportToExcel(data, '人员列表');
        toast.success('导出成功');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || '导出失败');
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = await importFromJSON<any[]>(file);
        toast.info(`已选择 ${data.length} 条数据，导入功能开发中...`);
      } catch (err: any) {
        toast.error(err.message || '导入失败');
      }
    };
    input.click();
  };

  const resetForm = () => { setEditItem(null); setForm({ name: '', username: '', password: '', role: 'employee', departmentId: '', position: '' }); };
  const openCreate = (deptId?: string) => { resetForm(); if (deptId) setForm(f => ({ ...f, departmentId: deptId })); setShowDialog(true); };

  const getLevelBadge = (level: number) => {
    if (level === 0) return <Badge className="bg-purple-100 text-purple-700 text-xs">一级</Badge>;
    if (level === 1) return <Badge className="bg-blue-100 text-blue-700 text-xs">二级</Badge>;
    return <Badge className="bg-cyan-100 text-cyan-700 text-xs">三级</Badge>;
  };

  const renderDept = (node: DeptNode, level: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const deptUsers = getUsersByDept(node.id);
    const hasUsers = deptUsers.length > 0;

    return (
      <div key={node.id}>
        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 border-b" style={{ paddingLeft: level * 24 + 8 }}>
          {hasChildren ? (
            <button onClick={() => toggle(node.id)} className="p-0.5 hover:bg-muted rounded">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : <div className="w-5" />}
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{node.name}</span>
          {getLevelBadge(level)}
          <span className="text-xs text-muted-foreground ml-1">({deptUsers.length}人)</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={() => openCreate(node.id)} disabled={!canCreateUser}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {isExpanded && hasUsers && (
          <div className="border-l-2 ml-4" style={{ marginLeft: level * 24 + 24 }}>
            {deptUsers.map(user => (
              <div key={user.id} className="flex items-center gap-3 p-2 pl-4 hover:bg-muted/30">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{user.name}</div>
                  <div className="text-xs text-muted-foreground">@{user.username} · {user.position || '未设置职位'}</div>
                </div>
                <Badge className={user.roleInfo ? `bg-primary/10 text-primary` : ''}>{user.roleInfo?.label || user.role}</Badge>
                <div className="flex gap-1">
                  {isAdmin && (
                    <Button variant="ghost" size="sm" title="重置密码" onClick={() => handleResetPassword(user.id, user.name)}>
                      <Key className="w-3 h-3 text-orange-500" />
                    </Button>
                  )}
                  {canEditUser && <Button variant="ghost" size="sm" onClick={() => onEdit(user, node.id)}><Edit className="w-3 h-3" /></Button>}
                  {canDeleteUser && <Button variant="ghost" size="sm" onClick={() => onDelete(user.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {isExpanded && hasChildren && node.children.map(child => renderDept(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl">人员管理</h1>
            <p className="text-muted-foreground text-sm">按组织架构展示员工，共 {users.length} 人</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" />导出</Button>
            <Button variant="outline" onClick={handleImport}><Upload className="w-4 h-4 mr-2" />导入</Button>
            <Button onClick={() => openCreate()} disabled={!canCreateUser}><Plus className="w-4 h-4 mr-2" />新建员工</Button>
          </div>
        </div>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : deptTree.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">暂无部门数据</div>
            ) : (
              <div className="space-y-1">{deptTree.map(node => renderDept(node))}</div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? '编辑员工' : '新建员工'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>姓名 *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>用户名 *</Label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></div>
            </div>
            <div className="space-y-2"><Label>密码 {editItem && '(留空不修改)'}</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editItem} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>部门</Label>
                <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">-- 选择部门 --</option>
                  {flatDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="employee">员工</option>
                  <option value="manager">经理</option>
                  <option value="executive">高管</option>
                  <option value="ceo">CEO</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>职位</Label><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></div>
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
