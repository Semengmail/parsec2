'use client';

import { create } from 'zustand';
import {
  getMyInvitees,
  getMyReferralBonuses,
} from '@/entities/referral/api/referral.api';
import type {
  MyInviteesResponse,
  ReferrerBonusesResponse,
} from '@/entities/referral/api/types';

type ReferralState = {
  invitees: MyInviteesResponse | null;
  bonuses: ReferrerBonusesResponse | null;

  loadingInvitees: boolean;
  loadingBonuses: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  reset: () => void;
};

export const useReferralStore = create<ReferralState>((set, get) => ({
  invitees: null,
  bonuses: null,

  loadingInvitees: false,
  loadingBonuses: false,
  loaded: false,

  async load() {
    if (get().loaded) return;

    set({
      loadingInvitees: true,
      loadingBonuses: true,
    });

    try {
      const [invitees, bonuses] = await Promise.all([
        getMyInvitees(),
        getMyReferralBonuses(),
      ]);

      set({
        invitees,
        bonuses,
        loaded: true,
      });
    } finally {
      set({
        loadingInvitees: false,
        loadingBonuses: false,
      });
    }
  },

  reset() {
    set({
      invitees: null,
      bonuses: null,
      loaded: false,
    });
  },
}));
