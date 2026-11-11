export type User = {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  balanceCents: string;
  tariff: 'none' | 'light' | 'chic';
  status: 'active' | 'blocked';
  createdAt: string | Date;
  updatedAt: string | Date;
  lastLoginAt: string | Date | null;
};
