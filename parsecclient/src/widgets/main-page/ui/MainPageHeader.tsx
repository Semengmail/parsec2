'use client';

import IcoAccount from '@/shared/assets/svg/Account';
import IcoLogin from '@/shared/assets/svg/Login';
import { Paths } from '@/shared/config/paths';
import { Logo } from '@/shared/ui';
import { Box, Burger, Button, Divider, Drawer, Group } from '@mantine/core';
import cx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './MainPageHeader.module.scss';

const MainPageHeader: React.FC<{ slogan?: string }> = () => {
  // const mainPageUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const mainPageUrl = '';
  const path = usePathname();
  const [menuOpened, setMenuOpened] = useState(false);
  const user = null;

  useEffect(() => {
    if (user) {
      // router.push(Paths.PROJECTS);
      const redirectUrl = `${Paths.DASHBOARD}`;
      window.location.href = redirectUrl;
    }
  }, [path]);

  return (
    <Box component="header" className={styles.header}>
      <Group h="100%" px="md" className={styles.container}>
        <Group justify="space-between" style={{ flex: 1 }}>
          <Logo />

          <Group ml="xl" gap={0} visibleFrom="sm">
            <nav className={styles.nav}>
              <ul>
                <li>
                  <a href={`/#how-is-work`}>Как работает</a>
                </li>
                <li>
                  <a href={`/#tariffs`}>Тарифы</a>
                </li>
              </ul>
            </nav>
          </Group>

          <Group ml="xl" gap={30} visibleFrom="sm">
            <a href={`${mainPageUrl}${Paths.LOGIN}`}>
              <IcoLogin size={17} /> Вход
            </a>
            <a href={`${mainPageUrl}${Paths.REGISTER}`}>
              <IcoAccount size={17} />
              Регистрация
            </a>
          </Group>

          <Burger
            opened={menuOpened}
            onClick={() => setMenuOpened(!menuOpened)}
            hiddenFrom="sm"
          />
          <Drawer
            opened={menuOpened}
            onClose={() => setMenuOpened(false)}
            position="right"
            size="100%"
            className={styles.mobileMenu}
            title={<Logo />}
          >
            <Divider />
            <Group mt="md" my={30} gap="sm" justify={'space-between'}>
              <Button
                className={cx(styles.button, styles.blue)}
                component="a"
                href={`${mainPageUrl}${Paths.LOGIN}`}
                variant="filled"
              >
                <IcoAccount size={25} /> Регистрация
              </Button>
              <Button
                className={cx(styles.button, styles.orange)}
                component="a"
                href={`${mainPageUrl}${Paths.REGISTER}`}
                variant="outline"
              >
                <IcoLogin size={25} /> Вход
              </Button>
            </Group>
            <Divider my={30} />
            <nav>
              <ul>
                <li>
                  <Link
                    href="/#how-is-work"
                    onClick={() => setMenuOpened(false)}
                  >
                    Как работает
                  </Link>
                </li>
                <li>
                  <Link href="/#tariffs" onClick={() => setMenuOpened(false)}>
                    Тарифы
                  </Link>
                </li>
              </ul>
            </nav>
          </Drawer>
        </Group>
      </Group>
    </Box>
  );
};

export { MainPageHeader };
