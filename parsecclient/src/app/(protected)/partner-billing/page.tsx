'use client';

import { PartnerBillingPage } from '@/features/partner-billing/pages/PartnerBillingPage';
import { BalanceModal } from '@/features/payment';
import { AppHeader } from '@/widgets/app-header/AppHeader';
import { SideNav } from '@/widgets/side-nav/SideNav';
import { Title } from '@mantine/core';
import React, { useState } from 'react';

const PartnerPage: React.FC = () => {
  const [balanceModalOpened, setBalanceModalOpened] = useState(false);
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      <AppHeader />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav />

        <main style={{ padding: 16, flex: 1 }}>
          <Title order={2} mb="md">
            {'Доходы по партнёрке'}
          </Title>
          <PartnerBillingPage />{' '}
        </main>
      </div>
      <BalanceModal
        opened={balanceModalOpened}
        onClose={() => setBalanceModalOpened(false)}
      />
    </div>
  );
};

export default PartnerPage;
