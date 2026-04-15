import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FadeIn } from '@/components/MotionPrimitives';
import { User, Mail, Phone, Building, Briefcase, Calendar, Shield, Save } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export default function Profile() {
  const { user, getProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    position: user?.position || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 页面加载时刷新用户信息
  useEffect(() => {
    getProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当用户信息更新时同步表单数据
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        position: user.position || '',
      }));
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await apiClient.put(`/users/${user?.id}`, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        position: formData.position,
      });
      await getProfile();
      toast.success('个人信息更新成功');
    } catch (error: any) {
      toast.error(error.response?.data?.error || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!formData.newPassword) {
      toast.error('请输入新密码');
      return;
    }
    
    if (formData.newPassword.length < 6) {
      toast.error('密码长度至少6位');
      return;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      await apiClient.put(`/users/${user?.id}/password`, {
        newPassword: formData.newPassword,
      });
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast.success('密码修改成功');
    } catch (error: any) {
      toast.error(error.response?.data?.error || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  const getRoleName = (role: string) => {
    const roleMap: Record<string, string> = {
      ceo: 'CEO',
      executive: '高管',
      manager: '经理',
      employee: '员工',
    };
    return roleMap[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colorMap: Record<string, string> = {
      ceo: 'destructive',
      executive: 'default',
      manager: 'secondary',
      employee: 'outline',
    };
    return colorMap[role] || 'default';
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <FadeIn>
        <h1 className="font-bold" style={{ fontSize: 'var(--font-size-headline)' }}>
          个人中心
        </h1>
        <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-label)' }}>
          管理您的个人信息和账号设置
        </p>
      </FadeIn>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 个人信息卡片 */}
        <FadeIn className="md:col-span-1">
          <Card>
            <CardContent className="pt-6 text-center">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4"
                style={{ background: 'oklch(0.42 0.19 250)' }}
              >
                {user.name[0]}
              </div>
              <h3 className="text-xl font-semibold">{user.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">@{user.username}</p>
              <div className="mt-4">
                <Badge variant={getRoleColor(user.role) as any}>
                  {getRoleName(user.role)}
                </Badge>
              </div>
              
              <Separator className="my-6" />
              
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <span>{user.department?.name || '未分配部门'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <span>{user.position || '未设置职位'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{user.email || '未设置邮箱'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{user.phone || '未设置电话'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* 编辑表单 */}
        <FadeIn className="md:col-span-2 space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">姓名</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">职位</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">电话</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                保存修改
              </Button>
            </CardContent>
          </Card>

          {/* 修改密码 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                修改密码
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  placeholder="请输入新密码（至少6位）"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="请再次输入新密码"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleChangePassword} disabled={loading} variant="outline">
                  修改密码
                </Button>
                <Button 
                  onClick={async () => {
                    if (confirm('确定要重置密码为默认密码 123456 吗？')) {
                      try {
                        await apiClient.put(`/users/${user?.id}/password`, { newPassword: '123456' });
                        toast.success('密码已重置为 123456');
                      } catch (error: any) {
                        toast.error(error.response?.data?.error || '重置失败');
                      }
                    }
                  }}
                  disabled={loading}
                  variant="destructive"
                >
                  重置密码
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 账号信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                账号信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">用户名</span>
                  <span>{user.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">角色</span>
                  <Badge variant={getRoleColor(user.role) as any}>
                    {getRoleName(user.role)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">所属部门</span>
                  <span>{user.department?.name || '未分配'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">账号状态</span>
                  <Badge variant="outline" className="bg-green-100 text-green-700">正常</Badge>
                </div>
                {user.lastLoginAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最后登录</span>
                    <span>{new Date(user.lastLoginAt).toLocaleString('zh-CN')}</span>
                  </div>
                )}
                {user.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">创建时间</span>
                    <span>{new Date(user.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
