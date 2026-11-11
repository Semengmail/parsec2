import { create } from 'zustand';
import {
  fetchTopupClients,
  fetchRevenueServices,
  fetchTopupsMonthWeeks,
  fetchRegistrations,
  TopupClientsItem,
  RevenueServicesItem,
  TopupsMonthWeeksItem,
  RegistrationsItem,
} from '../api/economy-api';

type EconomyState = {
  loading: boolean;
  topupClients: TopupClientsItem[] | null;
  revenue: RevenueServicesItem[] | null;
  topups: TopupsMonthWeeksItem[] | null;
  registrations: RegistrationsItem[] | null;
  error: string | null;
};

type EconomyActions = {
  loadAll: () => Promise<void>;
};

export const useEconomyStore = create<EconomyState & EconomyActions>((set) => ({
  loading: false,
  topupClients: null,
  revenue: null,
  topups: null,
  registrations: null,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null });
    try {
      const [c, r, t, rg] = await Promise.all([
        fetchTopupClients({ threshold: 100 }),
        fetchRevenueServices(),
        fetchTopupsMonthWeeks(),
        fetchRegistrations(),
      ]);

      set({
        loading: false,
        topupClients: c,
        revenue: r,
        topups: t,
        registrations: rg,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },
}));
