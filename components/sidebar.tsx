'use client';

import { Button } from '@/components/ui/button';
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  Calendar,
  CheckSquare,
  ChevronLeft, ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Home,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  Wrench
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';

type SidebarProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

const navGroups = [
  {
    label: '核心功能',
    items: [
      { href: '/', icon: Home, text: '首页' },
      { href: '/documents', icon: FileText, text: '文档管理' },
      { href: '/schedule', icon: Calendar, text: '日程安排' },
      { href: '/message-center', icon: MessageSquare, text: '消息中心' },
      { href: '/approval', icon: CheckSquare, text: '审批管理' },
    ],
  },
  {
    label: '业务管理',
    items: [
      { href: '/employee', icon: Users, text: '员工管理' },
      { href: '/users', icon: ShieldCheck, text: '用户管理' },
      { href: '/customer-followup', icon: UserCheck, text: '客户跟进' },
      { href: '/organization', icon: Building2, text: '组织架构' },
      { href: '/cashier', icon: DollarSign, text: '收银管理' },
      { href: '/inventory', icon: Package, text: '库存管理' },
    ],
  },
  {
    label: '智能服务',
    items: [
      { href: '/ai-assistant', icon: Bot, text: 'AI 助手' },
      { href: '/ai-maintenance', icon: Wrench, text: 'AI 运维' },
      { href: '/design-tools', icon: SlidersHorizontal, text: '设计工具' },
    ],
  },
  {
    label: '系统管理',
    items: [
      { href: '/system-health', icon: Activity, text: '系统健康' },
      { href: '/system-diagnostics', icon: BarChart3, text: '系统诊断' },
      { href: '/progress', icon: Clock, text: '进度跟踪' },
      { href: '/settings', icon: Settings, text: '系统设置' },
    ],
  },
];

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const toggleSidebar = () => setIsOpen(!isOpen);
  const pathname = usePathname();

  return (
    <div
      className={`bg-gray-800 text-white transition-all duration-300 flex flex-col ${isOpen ? 'w-64' : 'w-16'}`}
    >
      <div className="flex justify-end p-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          {isOpen ? <ChevronLeft /> : <ChevronRight />}
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {isOpen && (
              <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarItem
                    key={item.href}
                    href={item.href}
                    icon={<item.icon className="h-4 w-4" />}
                    text={item.text}
                    isOpen={isOpen}
                    isActive={isActive}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

type SidebarItemProps = {
  href: string;
  icon: React.ReactNode;
  text: string;
  isOpen: boolean;
  isActive?: boolean;
};

function SidebarItem({ href, icon, text, isOpen, isActive }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center space-x-2 p-2 rounded transition-colors ${isActive
          ? 'bg-blue-600 text-white'
          : 'hover:bg-gray-700 text-gray-300'
        }`}
      title={!isOpen ? text : undefined}
    >
      {icon}
      {isOpen && <span className="text-sm">{text}</span>}
    </Link>
  );
}
