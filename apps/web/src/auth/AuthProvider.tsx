import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  getAccessToken,
  getRefreshToken,
  setOnAuthLost,
  setTokens,
} from '../lib/api';
import type { LoginResponse, User } from '../lib/types';
import { AuthContext, type AuthState } from './context';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    setTokens(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setOnAuthLost(() => {
      clear();
    });
    return () => setOnAuthLost(null);
  }, [clear]);

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get<User>('/auth/me');
        if (active) setUser(res.data);
      } catch {
        if (active) clear();
      } finally {
        if (active) setLoading(false);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, [clear]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    setTokens(res.data);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch {
        /* ignore — clearing locally anyway */
      }
    }
    clear();
  }, [clear]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
