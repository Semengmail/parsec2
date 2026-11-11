'use client';

import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Button,
  Center,
  Group,
  Menu,
  Skeleton,
  Text,
  rem,
} from '@mantine/core';
import { formatRubHumanThousandths } from '@/shared/utils/money/formatThousandths';
import { LogoutButton } from '@/features/Logout/Logout';
import { getMyBalance } from '@/entities/user/api/getMyBalance';
import { BalanceModal } from '@/features/payment';
import Link from 'next/link';
import { Paths } from '@/shared/config/paths';

export function AppHeader() {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceModalOpened, setBalanceModalOpened] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { balance } = await getMyBalance();
        if (alive) setBalance(balance);
      } catch (e) {
        console.error('Не удалось получить баланс', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header
      style={{
        height: 56,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        background: 'var(--mantine-color-body)',
      }}
    >
      <Group h="100%" px="md" justify="space-between" wrap="nowrap">
        {/* ЛОГО (пока заглушка) */}
        <Group gap="xs" wrap="nowrap">
          <div
            aria-label="Logo"
            style={{
              width: rem(120),
              height: rem(28),
              borderRadius: 6,
              background: 'var(--mantine-color-gray-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            <Text fw={600}>Parsec</Text>
          </div>
        </Group>

        {/* Правый блок: Баланс + Профиль */}
        <Group gap="lg" wrap="nowrap">
          {/* Баланс */}
          <Group gap="xs" wrap="nowrap">
            {loading ? (
              <Skeleton width={120} height={20} />
            ) : (
              <Text fw={600} title="Текущий баланс">
                {balance != null ? formatRubHumanThousandths(balance) : '—'}
              </Text>
            )}
            <Button
              variant="light"
              size="xs"
              onClick={() => {
                setBalanceModalOpened(true);
              }}
            >
              Пополнить
            </Button>
          </Group>

          {/* Профиль */}
          <Menu shadow="md" width={180} withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="Профиль">
                <Avatar size={28} radius="xl" />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item>
                <Link href={Paths.REFERRAL}>
                  <Center>Партнёрка</Center>
                </Link>
              </Menu.Item>
              <Menu.Item color="red">
                <LogoutButton />
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      <BalanceModal
        opened={balanceModalOpened}
        onClose={() => setBalanceModalOpened(false)}
      />
    </header>
  );
}
