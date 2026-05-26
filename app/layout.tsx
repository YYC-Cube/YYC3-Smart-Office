import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import type React from 'react';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0C70F2',
};

export const metadata: Metadata = {
  title: {
    template: '%s | YYC³ 智能办公',
    default: 'YYC³ Smart-Office 智能办公系统',
  },
  description:
    'YYC³ Smart-Office — 基于「五高五标五化五维」核心架构的企业级智能办公平台',
  generator: 'YYC³',
  applicationName: 'YYC³ Smart-Office',
  keywords: ['智能办公', 'Smart Office', 'YYC³', 'Next.js', '企业级'],
  authors: [{ name: 'YYC³ Team', url: 'https://github.com/YYC-Cube' }],
  creator: 'YYC³ YanYuCloudCube Team',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3029'),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'YYC³ Smart-Office',
    title: 'YYC³ Smart-Office 智能办公系统',
    description: '基于「五高五标五化五维」核心架构的企业级智能办公平台',
    images: [{ url: '/yyc3-icons/pwa/icon-512x512.png', width: 512, height: 512, alt: 'YYC³' }],
  },
  twitter: {
    card: 'summary',
    title: 'YYC³ Smart-Office',
    images: ['/yyc3-icons/pwa/icon-512x512.png'],
  },
  icons: {
    icon: [
      { url: '/yyc3-icons/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/yyc3-icons/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/yyc3-icons/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/yyc3-icons/favicon/favicon.ico',
    apple: [
      { url: '/yyc3-icons/ios/icon-1024.png', sizes: '1024x1024', type: 'image/png' },
      { url: '/yyc3-icons/ios/icon-180.png' },
    ],
  },
  manifest: '/yyc3-icons/pwa/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'YYC³ 智能办公' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <link rel="icon" href="/yyc3-icons/favicon/favicon.ico" sizes="any" />
        <link rel="icon" href="/yyc3-icons/favicon/favicon-96x96.png" type="image/png" sizes="96x96" />
        <link rel="apple-touch-icon" href="/yyc3-icons/ios/icon-1024.png" />
        <link rel="manifest" href="/yyc3-icons/pwa/manifest.json" />
      </head>
      <body className={`${inter.className} bg-slate-50 min-h-screen`}>
        <AuthProvider>
          <div className="min-h-screen">{children}</div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
