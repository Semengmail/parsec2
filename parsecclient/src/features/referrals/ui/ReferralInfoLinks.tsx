'use client';

import { useCallback, useRef, useState } from 'react';

import { useAuthStore } from '@/entities/user/model/use-auth-store';
import { useReferralStore } from '@/entities/referral/model/referral.store';

import { copyToClipboard } from '@/shared/utils/clipboard/copyToClipboard';
import { useSelectOnFocus } from '@/shared/lib/hooks/useSelectOnFocus';
import CopyIcon from '@/shared/assets/svg/Copy';

import styles from './ReferralInfo.module.scss';

const siteUrl =
  process.env.NEXT_PUBLIC_MAIN_PAGE_URL || 'https://parsec.toolzar.ru';

export const ReferralInfoLinks: React.FC = () => {
  // ✅ берём пользователя из существующего zustand
  const user = useAuthStore((s) => s.user);

  // ✅ итог по реферальным бонусам
  const total = useReferralStore((s) => s.bonuses?.total ?? 0);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const refLink = useRef<HTMLInputElement | null>(null);
  const refCode = useRef<HTMLInputElement | null>(null);
  const { handleFocus } = useSelectOnFocus();

  const referralCode = user?.referralCode ?? '';
  const referralUrl = referralCode
    ? `${siteUrl}?ref=${referralCode}`
    : 'нет реферальной ссылки';

  const handleCopy = useCallback(
    async (
      value: string,
      ref: React.RefObject<HTMLInputElement | null>,
      field: string,
    ) => {
      if (!value) return;

      const ok = await copyToClipboard(value);
      if (ok) {
        setCopiedField(field);
        ref.current?.select();
        setTimeout(() => setCopiedField(null), 1500);
      }
    },
    [],
  );

  if (!user) return null;

  return (
    <div className={styles.referralInfoLinksContainer}>
      <div className={styles.referralReward}>
        <div className={styles.referralRewardLeft}>
          <div className={styles.referralTitle}>Вы заработали</div>
          <div className={styles.referralRewardSum}>{total} ₽</div>
        </div>
      </div>

      {/* Реферальная ссылка */}
      <div className={styles.referralInfoItem}>
        <label htmlFor="your_link" className={styles.linkLabel}>
          Ваша реферальная ссылка
        </label>
        <div className={styles.inputBlock}>
          <input
            className={styles.input}
            id="your_link"
            type="text"
            readOnly
            value={referralUrl}
            ref={refLink}
            onFocus={handleFocus}
            onClick={handleFocus}
          />
          <button
            type="button"
            className={styles.copyButton}
            onClick={() => handleCopy(referralUrl, refLink, 'link')}
            aria-label="Скопировать реферальную ссылку"
            title="Скопировать реферальную ссылку"
            disabled={!referralUrl || referralUrl === 'нет реферальной ссылки'}
          >
            <CopyIcon size={20} />
            {copiedField === 'link' ? 'Скопировано!' : 'Скопировать'}
          </button>
        </div>
      </div>

      {/* Промокод */}
      <div className={styles.referralInfoItem}>
        <label htmlFor="your_code" className={styles.linkLabel}>
          Ваш промокод
        </label>
        <div className={styles.inputBlock}>
          <input
            className={styles.input}
            id="your_code"
            type="text"
            readOnly
            value={referralCode}
            ref={refCode}
            onFocus={handleFocus}
            onClick={handleFocus}
          />
          <button
            type="button"
            className={styles.copyButton}
            onClick={() => handleCopy(referralCode, refCode, 'code')}
            aria-label="Скопировать промокод"
            title="Скопировать промокод"
            disabled={!referralCode}
          >
            <CopyIcon size={20} />
            {copiedField === 'code' ? 'Скопировано!' : 'Скопировать'}
          </button>
        </div>
      </div>
    </div>
  );
};
