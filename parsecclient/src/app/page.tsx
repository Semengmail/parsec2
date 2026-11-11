import { Suspense } from 'react';

import { MainPage } from '@/widgets/main-page';
import { ReferralCookieSetter } from '@/widgets/ReferralCookieSetter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const Page: React.FC = () => {
  return (
    <>
      <MainPage />
      <Suspense fallback={null}>
        <ReferralCookieSetter />
      </Suspense>
    </>
  );
};

export default Page;
