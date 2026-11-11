import { SideNav } from '@/widgets/side-nav/SideNav';
import { DashboardOverview } from '@/widgets/dashboard/DashboardOverview';
import { AppHeader } from '@/widgets/app-header/AppHeader';

export default function Home() {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      <AppHeader />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav />
        <main style={{ padding: 16, flex: 1 }}>
          <DashboardOverview />
        </main>
      </div>
    </div>
  );
}
