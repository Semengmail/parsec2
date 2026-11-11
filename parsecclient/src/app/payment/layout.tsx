import { redirect } from 'next/navigation';
import { Paths } from '@/shared/config/paths';

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUB_MODE === 'true') {
    redirect(Paths.DASHBOARD);
  }
  return children;
}
