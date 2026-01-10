'use client';

import { Bell, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConnectionStatus } from '@/hooks/useWebSocket';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function Header() {
  const isConnected = useConnectionStatus();

  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-6">
        {/* Page title placeholder */}
        <div />

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                <span className="text-muted-foreground">Disconnected</span>
              </>
            )}
          </div>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
