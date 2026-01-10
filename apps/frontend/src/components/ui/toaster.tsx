'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from 'next-themes';

export function Toaster() {
  const { theme } = useTheme();

  return (
    <SonnerToaster
      theme={theme as 'light' | 'dark' | 'system'}
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error: 'group-[.toaster]:bg-destructive group-[.toaster]:text-destructive-foreground',
          success: 'group-[.toaster]:bg-success group-[.toaster]:text-success-foreground',
        },
      }}
    />
  );
}
