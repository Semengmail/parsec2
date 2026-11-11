'use client';

import { MainPageFooter, MainPageHeader } from '@/widgets/main-page';
import { Badge, Card, Flex, Text, Title } from '@mantine/core';
import templateStyles from '../../main.module.scss';
import styles from '../policy.module.scss';

const Policy: React.FC = () => {
  const tariffs = [
    {
      name: 'Базовый',
      discount: 0,
      amount: 0,
      pos: 20, // 1 = 0,001 rub
      freq: 17,
    },
  ];

  return (
    <div className={templateStyles.mainWrapper}>
      <MainPageHeader />
      <section className={styles.wrapper}>
        <h1 className={styles.title}>Тарифы</h1>

        <div className={styles.tariffsContainer}>
          {tariffs.map((tariff, index) => (
            <Card
              key={index}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              className={styles.tariffCard}
            >
              <Flex justify="space-between" align="center" mb="xs">
                <Title order={3}>{tariff.name} </Title>
                <Badge color="blue" size="lg">
                  {tariff.discount > 0
                    ? `Скидка ${tariff.discount}%`
                    : 'Без скидки'}
                </Badge>
              </Flex>
              <Flex direction="column" gap="sm">
                <Text size="sm" c="dimmed">
                  <b>Цена за одну страницу ₽:</b>
                </Text>
                <Text size="sm" c="dimmed">
                  <b>Сбор позиций:</b> {tariff.pos * 0.001}
                </Text>
                {/* <Text size="sm" c="dimmed">
                  <b>Сбор частоты:</b> {tariff.freq * 0.001}
                </Text> */}
              </Flex>
            </Card>
          ))}
        </div>
      </section>
      <MainPageFooter />
    </div>
  );
};

export default Policy;
