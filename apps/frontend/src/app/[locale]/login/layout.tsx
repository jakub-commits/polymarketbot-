import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
