'use client';

import { Text, Button, Card, Group, Divider, Title } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getMyBalance } from '@/entities/user/api/getMyBalance';
import { Paths } from '@/shared/config/paths';

const PaymentSuccessPage: React.FC = () => {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const formattedBalance = balance ? Number(balance) / 1000 : 0;

  useEffect(() => {
    (async () => {
      try {
        const { balance } = await getMyBalance();
        console.log('balance', balance);
        setBalance(balance);
      } catch (e) {
        console.error('Не удалось получить баланс', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <Text>Загрузка...</Text>
      </div>
    );
  }

  if (!balance) {
    return (
      <>
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{ maxWidth: 500, margin: 'auto' }}
          >
            <Group justify="center">
              <Title order={2} mb="md">
                Оплата прошла успешно!
              </Title>
            </Group>
            <Divider my="md" />
            <Text size="lg" mb="lg">
              Можете закрывать данную страницу или нажать на кнопку ниже, чтобы
              перейти на сайт.
            </Text>
            <Divider my="md" />
            <Button
              onClick={() => router.push(Paths.DASHBOARD)}
              variant="filled"
              color="blue"
              mt="lg"
              radius="md"
              fullWidth
            >
              Перейти на сайт
            </Button>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{ maxWidth: 500, margin: 'auto' }}
        >
          <Group justify="center">
            <Title order={2} mb="md">
              Спасибо!
            </Title>
          </Group>
          <Divider my="md" />
          <Text size="lg" mb="sm">
            Оплата прошла успешно!
          </Text>
          {formattedBalance && (
            <Text size="lg" mb="sm">
              Текущий баланс: <strong>{formattedBalance}</strong> ₽
            </Text>
          )}
          <Divider my="md" />
          <Button
            onClick={() => router.push(Paths.DASHBOARD)}
            variant="filled"
            color="blue"
            mt="lg"
            radius="md"
            fullWidth
          >
            Закрыть
          </Button>
        </Card>
      </div>
    </>
  );
};

export default PaymentSuccessPage;
