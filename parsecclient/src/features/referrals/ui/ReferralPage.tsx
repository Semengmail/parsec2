'use client';

import { Center, Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { ReferralInfo } from './ReferralInfo';
import { ReferralInviteesList } from './ReferralInviteesList';
import { ReferralIncomeList } from './ReferralIncomeList';
import { useReferralStore } from '@/entities/referral/model/referral.store';
import styles from './ReferralPage.module.scss';
import { AppHeader } from '@/widgets/app-header/AppHeader';
import { SideNav } from '@/widgets/side-nav/SideNav';
import { BalanceModal } from '@/features/payment';

export const ReferralPage: React.FC = () => {
  const [balanceModalOpened, setBalanceModalOpened] = useState(false);
  const load = useReferralStore((s) => s.load);
  const loadingInvitees = useReferralStore((s) => s.loadingInvitees);
  const loadingBonuses = useReferralStore((s) => s.loadingBonuses);

  useEffect(() => {
    load();
  }, [load]);

  const loading = loadingInvitees || loadingBonuses;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      <AppHeader />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav />

        <main style={{ padding: 16, flex: 1 }}>
          <div className={styles.contentWrap}>
            <div className={styles.referralContent}>
              {loading ? (
                <Center className={styles.loader}>
                  <Loader color="blue" />
                </Center>
              ) : (
                <div className={styles.referralContentContainer}>
                  <ReferralInfo />
                  <ReferralInviteesList />
                  <ReferralIncomeList />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <BalanceModal
        opened={balanceModalOpened}
        onClose={() => setBalanceModalOpened(false)}
      />
    </div>
  );
};
