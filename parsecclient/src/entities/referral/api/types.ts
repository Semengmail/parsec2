// src/entities/referral/api/types.ts

export type ValidateCodeResponse = {
  valid: boolean;
};

export type InviteeItem = {
  email: string;
  registeredAt: string; // ISO
  bonusGiven: boolean;
  bonusAmount: number | null; // ₽
};

export type MyInviteesResponse = {
  total: number;
  withPayment: number;
  withoutPayment: number;
  list: InviteeItem[];
};

export type ReferrerBonusItem = {
  bonusAmount: number; // ₽
  inviteeEmail: string;
  bonusGivenAt: string; // ISO
};

export type ReferrerBonusesResponse = {
  total: number; // ₽
  list: ReferrerBonusItem[];
};

export type AttachReferralResponse = {
  success: boolean;
  message: string;
};
