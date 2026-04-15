import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { useBrand } from '@/contexts/BrandContext';
import { FadeIn } from '@/components/MotionPrimitives';
import { Building2, Lock, User, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const { login, loading, error } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const success = await login({ username, password, rememberMe });
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ 
        background: 'linear-gradient(135deg, oklch(0.18 0.02 250) 0%, oklch(0.42 0.19 250) 100%)',
      }}
    >
      <FadeIn>
        <Card className="w-full max-w-md shadow-xl" style={{ borderRadius: 'var(--radius-xl)' }}>
          <CardHeader className="text-center" style={{ padding: 'var(--spacing-xl)' }}>
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="Logo" className="mx-auto mb-4 w-16 h-16 object-contain" />
            ) : (
            <div 
              className="mx-auto mb-4 flex items-center justify-center"
              style={{ 
                width: '64px',
                height: '64px',
                background: 'oklch(0.42 0.19 250)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <Building2 className="w-8 h-8 text-white" />
            </div>
            )}
            <CardTitle style={{ fontSize: 'var(--font-size-headline)', fontWeight: 'var(--font-weight-bold)' }}>
              {brand.systemName}
            </CardTitle>
            <CardDescription style={{ fontSize: 'var(--font-size-label)' }}>
              {brand.welcomeText || '企业战略执行管理平台'}
            </CardDescription>
          </CardHeader>
          
          <CardContent style={{ padding: 'var(--spacing-xl)', paddingTop: 0 }}>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div 
                  className="flex items-center gap-2 p-3 rounded-lg text-sm"
                  style={{ 
                    background: 'oklch(0.95 0.03 25)',
                    color: 'oklch(0.55 0.22 25)',
                  }}
                >
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  记住密码
                </Label>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
                style={{ 
                  background: 'oklch(0.42 0.19 250)',
                  height: '44px',
                }}
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </form>

            <div 
              className="mt-6 p-4 rounded-lg"
              style={{ background: 'var(--muted)' }}
            >
              <p className="text-sm text-muted-foreground mb-2">测试账号：</p>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>CEO账号: ceo / 123456</p>
                <p>高管账号: product_director / 123456</p>
                <p>经理账号: pm1 / 123456</p>
                <p>员工账号: dev1 / 123456</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
