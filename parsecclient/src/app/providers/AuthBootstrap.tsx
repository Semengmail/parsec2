'use client';

import { useEffect } from 'react';
import { apiMe } from '@/entities/user/api/auth-api';
import { useAuthStore } from '@/entities/user/model/use-auth-store';

export const AuthBootstrap: React.FC = () => {
  const { setUser, setLoading, setError } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { user } = await apiMe();
        if (mounted) setUser(user);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
          setError(null);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setUser, setLoading, setError]);

  return null;
};
