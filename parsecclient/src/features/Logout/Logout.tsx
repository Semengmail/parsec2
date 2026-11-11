'use client';

import { useRouter } from 'next/navigation';
import { apiLogout } from '@/entities/user/api/auth-api';
import { useAuthStore } from '@/entities/user/model/use-auth-store';
import { Center } from '@mantine/core';
import { Paths } from '@/shared/config/paths';

export function LogoutButton() {
  const { logoutLocal } = useAuthStore();
  const router = useRouter();

  const onClick = async () => {
    await apiLogout();
    logoutLocal();
    router.replace(Paths.LOGIN);
  };

  return <Center onClick={onClick}>Выйти</Center>;
}
