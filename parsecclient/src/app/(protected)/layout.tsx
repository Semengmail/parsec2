import { COOKIE_NAME } from '@/shared/config/env';
import { Paths } from '@/shared/config/paths';
import { ErrorPlate } from '@/shared/ui/ErrorPlate';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { StubPage } from '@/widgets/stub-page/StubPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ck = await cookies();
  if (!ck.has(COOKIE_NAME)) {
    redirect(Paths.LOGIN);
  }
  if (process.env.NEXT_PUBLIC_STUB_MODE === 'true') {
    return <StubPage />;
  }
  return (
    <>
      <ErrorPlate />
      {children}
    </>
  );
}
