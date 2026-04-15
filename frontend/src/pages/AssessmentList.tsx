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
import { Plus, Calculator, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { apiClient, getErrorMessage } from '@/lib/api-client';
import { usePermission } from '@/hooks/use-permission';

export default function AssessmentList() {
  const { hasPermission } = usePermission();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [showCalcDialog, setShowCalcDialog] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ userId: '', score: '', comment: '', period: new Date().toISOString().slice(0, 7), type: 'monthly' });
  const [calcForm, setCalcForm] = useState({ period: new Date().toISOString().slice(0, 7), departmentId: '' });
  const [calcResult, setCalcResult] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => { loadData(); loadOptions(); }, [page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/assessments?page=${page}&limit=20`);
      if (res.data.success) {
        setList(res.data.data.items);
        setTotal(res.data.data.total);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadOptions = async () => {
    try {
      const [uRes, dRes] = await Promise.all([apiClient.get('/users?limit=100'), apiClient.get('/departments/list')]);
      if (uRes.data.success) setUsers(uRes.data.data?.items || []);
      if (dRes.data.success) setDepartments(dRes.data.data || []);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId || !form.period || !form.score) return;
    try {
      setSaving(true);
      await apiClient.post('/assessments', { ...form, score: parseInt(form.score) });
      setShowDialog(false);
      setForm({ userId: '', score: '', comment: '', period: new Date().toISOString().slice(0, 7), type: 'monthly' });
      loadData();
    } catch (err: any) { alert(err.response?.data?.error || getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleCalc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcForm.period) return;
    try {
      setSaving(true);
      const url = calcForm.departmentId ? '/assessments/calculate-dept' : '/assessments/calculate';
      const body = calcForm.departmentId
        ? { period: calcForm.period, departmentId: calcForm.departmentId }
        : { period: calcForm.period, userId: users[0]?.id };
      const res = await apiClient.post(url, body);
      if (res.data.success) {
        if (Array.isArray(res.data.data)) {
          setCalcResult(res.data.data);
        } else {
          setCalcResult([res.data.data]);
        }
        loadData();
      }
    } catch (err: any) { alert(err.response?.data?.error || getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGradeLabel = (score: number) => {
    if (score >= 90) return { label: '优秀', color: 'bg-green-100 text-green-700' };
    if (score >= 80) return { label: '良好', color: 'bg-blue-100 text-blue-700' };
    if (score >= 70) return { label: '合格', color: 'bg-yellow-100 text-yellow-700' };
    return { label: '待改进', color: 'bg-red-100 text-red-700' };
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl">绩效考核</h1>
            <p className="text-muted-foreground text-sm">支持手动评分和基于任务数据的自动计算</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setCalcResult([]); setShowCalcDialog(true); }} disabled={!hasPermission('assessment:calculate')}>
              <Calculator className="w-4 h-4 mr-2" />自动计算绩效
            </Button>
            <Button onClick={() => setShowDialog(true)} disabled={!hasPermission('assessment:create')}>
              <Plus className="w-4 h-4 mr-2" />手动评分
            </Button>
          </div>
        </div>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
            ) : list.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">暂无考核记录</div>
            ) : (
              <div className="space-y-3">
                {list.map((item: any) => {
                  const grade = getGradeLabel(item.score);
                  return (
                    <div key={item.id} className="p-4 rounded-lg border hover:bg-muted/30 cursor-pointer" onClick={() => setShowDetail(item)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <div className={`text-2xl font-bold ${getScoreColor(item.score)}`}>{item.score}</div>
                            <div className="text-xs text-muted-foreground">手动分</div>
                          </div>
                          {item.autoScore !== null && item.autoScore > 0 && (
                            <div className="text-center border-l pl-3">
                              <div className={`text-2xl font-bold ${getScoreColor(item.autoScore)}`}>{Math.round(item.autoScore)}</div>
                              <div className="text-xs text-muted-foreground">自动分</div>
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{item.user?.name || '-'}</div>
                            <div className="text-xs text-muted-foreground">{item.user?.department?.name} · {item.period}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={grade.color}>{grade.label}</Badge>
                          {item.calculatedAt && <Badge variant="outline" className="text-xs">已计算</Badge>}
                        </div>
                      </div>
                      {item.autoScore > 0 && (
                        <div className="flex gap-6 mt-2 text-xs text-muted-foreground">
                          <span>任务完成: {item.taskCompleted}/{item.taskTotal}</span>
                          <span>实际工时: {item.workHoursActual}h</span>
                          <span>计划工时: {item.workHoursPlan}h</span>
                          <span>进度贡献: {item.progressContrib}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {total > 20 && (
                  <div className="flex justify-center gap-2 pt-4">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
                    <span className="text-sm py-2">第 {page} 页 / 共 {Math.ceil(total / 20)} 页</span>
                    <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>下一页</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* 手动评分 */}
      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>手动评分</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>被考核人 *</Label>
              <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="">-- 选择 --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department?.name})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>考核周期 *</Label><Input type="month" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} required /></div>
              <div className="space-y-2"><Label>分数 *</Label><Input type="number" min={0} max={100} value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} required /></div>
            </div>
            <div className="space-y-2"><Label>评语</Label><Textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} rows={3} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={saving}>{saving ? '提交中...' : '提交'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 自动计算绩效 */}
      <Dialog open={showCalcDialog} onOpenChange={(o) => { setShowCalcDialog(o); setCalcResult([]); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>自动计算绩效</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded bg-muted text-sm">
              <p className="font-medium mb-1">计算公式</p>
              <p>绩效分 = 任务完成率(40%) + 工时达成率(30%) + 进度贡献(30%)</p>
            </div>
            <form onSubmit={handleCalc} className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>考核周期 *</Label><Input type="month" value={calcForm.period} onChange={e => setCalcForm({ ...calcForm, period: e.target.value })} required /></div>
              <div className="space-y-2"><Label>部门（可选，不选则计算全部）</Label>
                <select value={calcForm.departmentId} onChange={e => setCalcForm({ ...calcForm, departmentId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">全部人员</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <Button type="submit" disabled={saving} className="w-full"><Calculator className="w-4 h-4 mr-2" />{saving ? '计算中...' : '开始计算'}</Button>
              </div>
            </form>

            {calcResult.length > 0 && (
              <div className="space-y-2">
                <div className="font-medium text-sm">计算结果</div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted"><th className="p-2 text-left">姓名</th><th className="p-2 text-center">自动分</th><th className="p-2 text-center">任务完成</th><th className="p-2 text-center">等级</th></tr></thead>
                    <tbody>
                      {calcResult.map((r: any, i: number) => {
                        const g = getGradeLabel(r.autoScore || 0);
                        return (
                          <tr key={i} className="border-t">
                            <td className="p-2">{r.name}</td>
                            <td className="p-2 text-center font-bold">{Math.round(r.autoScore || 0)}</td>
                            <td className="p-2 text-center">{r.taskCompleted}/{r.taskTotal}</td>
                            <td className="p-2 text-center"><Badge className={g.color}>{g.label}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 详情弹窗 */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>考核详情</DialogTitle></DialogHeader>
          {showDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">被考核人：</span>{showDetail.user?.name}</div>
                <div><span className="text-muted-foreground">部门：</span>{showDetail.user?.department?.name}</div>
                <div><span className="text-muted-foreground">周期：</span>{showDetail.period}</div>
                <div><span className="text-muted-foreground">类型：</span>{showDetail.type}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(showDetail.score)}`}>{showDetail.score}</div>
                  <div className="text-xs text-muted-foreground">手动评分</div>
                </div>
                {showDetail.autoScore != null && showDetail.autoScore > 0 && (
                  <div className="text-center border-l">
                    <div className={`text-3xl font-bold ${getScoreColor(showDetail.autoScore)}`}>{Math.round(showDetail.autoScore)}</div>
                    <div className="text-xs text-muted-foreground">自动计算</div>
                  </div>
                )}
              </div>
              {showDetail.autoScore > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-sm">绩效明细</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" />任务完成率</span>
                      <span className="text-sm">{showDetail.taskCompleted}/{showDetail.taskTotal} 任务</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-blue-500" />工时达成率</span>
                      <span className="text-sm">{showDetail.workHoursActual}/{showDetail.workHoursPlan} 小时</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm"><TrendingUp className="w-4 h-4 text-orange-500" />进度贡献</span>
                      <span className="text-sm">{showDetail.progressContrib}%</span>
                    </div>
                  </div>
                </div>
              )}
              {showDetail.comment && <div className="text-sm"><span className="text-muted-foreground">评语：</span>{showDetail.comment}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
