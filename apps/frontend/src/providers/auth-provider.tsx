'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
      } else {
        // Try to refresh token
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshResponse.ok) {
          // Retry getting user
          const retryResponse = await fetch(`${API_URL}/auth/me`, {
            credentials: 'include',
          });

          if (retryResponse.ok) {
            const data = await retryResponse.json();
            setUser(data.data.user);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Redirect logic
  useEffect(() => {
    if (isLoading) return;

    const isPublicPath = PUBLIC_PATHS.some((path) =>
      pathname?.includes(path)
    );

    if (!user && !isPublicPath) {
      // Get locale from pathname
      const locale = pathname?.split('/')[1] || 'en';
      router.push(`/${locale}/login`);
    } else if (user && isPublicPath) {
      // Redirect to dashboard if already logged in
      const locale = pathname?.split('/')[1] || 'en';
      router.push(`/${locale}`);
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setUser(data.data.user);

    // Store tokens in localStorage as backup
    if (data.data.tokens) {
      localStorage.setItem('accessToken', data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    setUser(data.data.user);

    // Store tokens in localStorage as backup
    if (data.data.tokens) {
      localStorage.setItem('accessToken', data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors
    }

    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    const locale = pathname?.split('/')[1] || 'en';
    router.push(`/${locale}/login`);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
