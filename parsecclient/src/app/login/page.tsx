import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { COOKIE_NAME } from '@/shared/config/env';
import { Paths } from '@/shared/config/paths';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function LoginFallback() {
  return <div style={{ maxWidth: 420, margin: '2rem auto' }}>Загрузка…</div>;
}

export default async function LoginPage() {
  const ck = await cookies();
  if (ck.has(COOKIE_NAME)) {
    redirect(Paths.DASHBOARD);
  }
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
