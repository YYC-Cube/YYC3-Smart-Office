'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
// import { useAuth } from '@/contexts/auth-context'; // 未使用的导入

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCaptcha, setGeneratedCaptcha] = useState('');
  const [csrfToken, setCsrfToken] = useState('');

  const fetchCsrfToken = async () => {
    try {
      const res = await fetch('/api/auth/csrf-token', { credentials: 'include' });
      if (res.ok) {
        const cookieStr = document.cookie || '';
        const match = cookieStr.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
        if (match && match[1]) {
          const token = decodeURIComponent(match[1]);
          setCsrfToken(token);
          return token;
        }
      }
    } catch { }
    return '';
  };

  useEffect(() => {
    fetchCsrfToken();
  }, []);
  // 生成随机验证码
  const generateCaptcha = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let newCaptcha = '';
    for (let i = 0; i < 4; i++) {
      newCaptcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedCaptcha(newCaptcha);
    sessionStorage.setItem('captcha', newCaptcha);
  };

  // 初始化生成验证码
  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 模拟验证码验证
      const storedCaptcha = sessionStorage.getItem('captcha');
      if (captcha.toLowerCase() !== storedCaptcha?.toLowerCase()) {
        setError('验证码错误');
        generateCaptcha();
        return;
      }

      // 模拟登录请求
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          captcha,
          generatedCaptcha,
          csrfToken: csrfToken,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 登录成功，跳转到首页
        sessionStorage.removeItem('captcha');
        router.push('/');
      } else {
        // 处理登录失败
        setError(data.message || '登录失败，请检查用户名和密码');
        generateCaptcha();
      }
    } catch {
      setError('登录失败，请检查网络连接后重试');
      generateCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">智能办公系统</CardTitle>
        <CardDescription>系统已简化版本</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名（已禁用）"
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（已禁用）"
              disabled
            />
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>系统简化</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <div className="flex items-center mb-4">
              <Label htmlFor="captcha" className="w-24">验证码</Label>
              <div className="flex gap-2 flex-1">
                <Input
                  id="captcha"
                  type="text"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  placeholder="请输入验证码"
                  className="flex-1"
                  maxLength={4}
                />
                <div
                  className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-lg font-bold cursor-pointer"
                  onClick={generateCaptcha}
                  style={{
                    background: 'linear-gradient(45deg, #f0f0f0 25%, #e0e0e0 25%, #e0e0e0 50%, #f0f0f0 50%, #f0f0f0 75%, #e0e0e0 75%, #e0e0e0 100%)',
                    backgroundSize: '10px 10px'
                  }}
                >
                  {generatedCaptcha}
                </div>
              </div>
            </div>
            {error && (
              <div className="text-red-500 text-sm mb-4">{error}</div>
            )}
          </div>
          <div className="mt-6">
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </div>
          <div className="mt-6 pt-4 border-t">
            <Alert className="bg-blue-50 border-blue-200 text-blue-700">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>开发环境登录提示</AlertTitle>
              <AlertDescription>
                用户名: admin, 密码: admin123
              </AlertDescription>
            </Alert>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
