'use client';

import { Center } from '@mantine/core';
import { useReferralStore } from '@/entities/referral/model/referral.store';
import styles from './ReferralInviteesList.module.scss';
import { dayjs } from '@/shared/lib/dates/dayjs';

const formatLocalDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const tz = dayjs.tz.guess();
  return dayjs(iso).tz(tz).format('DD.MM.YYYY [в] HH:mm');
};

export const ReferralInviteesList: React.FC = () => {
  const data = useReferralStore((s) => s.invitees);
  const loading = useReferralStore((s) => s.loadingInvitees);

  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.header}>Все приглашённые</h2>
        <Center m={30}>Загрузка…</Center>
      </div>
    );
  }

  if (!data || data.list.length === 0) {
    return (
      <div className={styles.container}>
        <h2 className={styles.header}>Все приглашённые</h2>
        <Center m={30}>Пока нет приглашённых</Center>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>
        Все приглашённые
        <span className={styles.counter}>({data.total})</span>
      </h2>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>№</th>
            <th>Email</th>
            <th>Дата регистрации</th>
            <th>Статус</th>
          </tr>
        </thead>

        <tbody>
          {data.list.map((item, idx) => (
            <tr key={`${item.email}-${idx}`}>
              <td>{idx + 1}</td>
              <td>{item.email}</td>
              <td>{formatLocalDateTime(item.registeredAt)}</td>
              <td>
                {item.bonusGiven ? (
                  <span className={styles.paid}>Оплатил</span>
                ) : (
                  <span className={styles.registered}>Зарегистрировался</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
