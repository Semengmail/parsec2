'use client';

import { Center } from '@mantine/core';
import dayjs from 'dayjs';
import { useReferralStore } from '@/entities/referral/model/referral.store';
import styles from './ReferralIncomeList.module.scss';

const formatLocalDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const tz = dayjs.tz.guess();
  return dayjs(iso).tz(tz).format('DD.MM.YYYY [в] HH:mm');
};

const formatRuble = (n?: number | null) =>
  typeof n === 'number'
    ? new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
      }).format(n)
    : '—';

export const ReferralIncomeList: React.FC = () => {
  const bonuses = useReferralStore((s) => s.bonuses?.list);

  if (!bonuses || bonuses.length === 0) {
    return (
      <div className={styles.incomeListContainer}>
        <h2 className={styles.incomeListHeader}>Реферальные доходы</h2>
        <Center m={30}>Нет реферальных доходов</Center>
      </div>
    );
  }

  return (
    <div className={styles.incomeListContainer}>
      <h2 className={styles.incomeListHeader}>Реферальные доходы</h2>

      <table className={styles.incomeListTable}>
        <thead>
          <tr>
            <th>№</th>
            <th>Дата</th>
            <th>Логин</th>
            <th>Вознаграждение</th>
          </tr>
        </thead>
        <tbody>
          {bonuses.map((b, idx) => (
            <tr key={`${b.inviteeEmail}-${b.bonusGivenAt}-${idx}`}>
              <td>{idx + 1}</td>
              <td>{formatLocalDateTime(b.bonusGivenAt)}</td>
              <td>{b.inviteeEmail || '—'}</td>
              <td>{formatRuble(b.bonusAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
