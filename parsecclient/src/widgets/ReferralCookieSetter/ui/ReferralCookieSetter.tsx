'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';

/**
 * Компонент записывает промокод из query-параметра ?ref=... в куки "referralCode".
 * Используется только на клиенте (App Router / Next 15)
 */
export const ReferralCookieSetter = () => {
  const params = useSearchParams();
  const isDev = process.env.NODE_ENV === 'development';
  useEffect(() => {
    const ref = params.get('ref');
    if (!ref) return;

    const existing = Cookies.get('referralCode');
    if (!existing) {
      Cookies.set('referralCode', ref, {
        expires: 7,
        sameSite: 'lax',
        path: '/',
        domain: isDev ? '.toolzar.localhost' : '.toolzar.ru',
      });
      console.log('💾 Referral code saved:', ref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return null;
};
