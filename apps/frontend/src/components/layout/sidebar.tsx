'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Wallet,
  BarChart3,
  Settings,
  Activity,
} from 'lucide-react';

const navigation = [
  { key: 'dashboard', href: '/', icon: LayoutDashboard },
  { key: 'traders', href: '/traders', icon: Users },
  { key: 'trades', href: '/trades', icon: TrendingUp },
  { key: 'positions', href: '/positions', icon: Wallet },
  { key: 'markets', href: '/markets', icon: BarChart3 },
  { key: 'analytics', href: '/analytics', icon: Activity },
  { key: 'settings', href: '/settings', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tSidebar = useTranslations('sidebar');

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b">
        <TrendingUp className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg">Polymarket Bot</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      {/* Status indicator */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">{tSidebar('botActive')}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {tSidebar('monitoring', { count: 3 })}
          </p>
        </div>
      </div>
    </aside>
  );
}
