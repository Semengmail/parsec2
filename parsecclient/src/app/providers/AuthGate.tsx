'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/entities/user/model/use-auth-store';
import { Center, Loader } from '@mantine/core';
import { Paths } from '@/shared/config/paths';

type Props = {
  children: React.ReactNode;
  redirectTo?: string;
  loadingFallback?: React.ReactNode;
};

export const AuthGate: React.FC<Props> = ({
  children,
  redirectTo = Paths.LOGIN,
  loadingFallback,
}) => {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const url = `${redirectTo}?next=${encodeURIComponent(pathname)}`;
      router.replace(url);
    }
  }, [loading, user, router, pathname, redirectTo]);

  const fallback = useMemo(
    () =>
      loadingFallback ?? (
        <Center h="60vh">
          <Loader />
        </Center>
      ),
    [loadingFallback]
  );

  if (loading) return fallback;
  if (!user) return null;

  return <>{children}</>;
};
