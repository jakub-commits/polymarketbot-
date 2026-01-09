'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Traders', href: '/traders', icon: Users },
  { name: 'Trades', href: '/trades', icon: TrendingUp },
  { name: 'Positions', href: '/positions', icon: Wallet },
  { name: 'Markets', href: '/markets', icon: BarChart3 },
  { name: 'Analytics', href: '/analytics', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

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
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Status indicator */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">Bot Active</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Monitoring 3 traders
          </p>
        </div>
      </div>
    </aside>
  );
}
