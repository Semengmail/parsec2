'use client';

import { Button, Text } from '@mantine/core';
import { FC } from 'react';
import { useRouter } from 'next/navigation';

import { Paths } from '@/shared/config/paths';

const PaymentErrorPage: FC = () => {
  const router = useRouter();
  return (
    <div
      style={{
        textAlign: 'center',
        marginTop: '50px',
      }}
    >
      <Text
        size="xl"
        w={500}
        c="red"
        mb="lg"
        flex={'center'}
        style={{ margin: '2rem auto' }}
      >
        Оплата не удалась
      </Text>
      <Text c="dimmed" mb="xl">
        К сожалению, при обработке платежа произошла ошибка. Попробуйте снова.
      </Text>
      <Button
        onClick={() => router.push(Paths.DASHBOARD)}
        variant="light"
        color="red"
      >
        Вернуться к списку проектов
      </Button>
    </div>
  );
};

export default PaymentErrorPage;
