// src/modules/users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Tariff } from '../../tariffs/entities/tariff.entity';
import { Payment } from '@/modules/payment/entities/payment.entity';
import { Referral } from '@/modules/referral/entities/referral.entity';

export type UserStatus = 'active' | 'blocked';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 100, select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  company!: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  role: string[];

  @Column({ type: 'int', default: 0 })
  authCount: number;

  /** Баланс в тысячных долях рубля (BIGINT как string) */
  @Column({
    type: 'bigint',
    default: 0,
    comment: 'Balance in thousandths of a ruble (1 unit = 0.001 RUB)',
  })
  balance!: string;

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  /** Связанный тариф по умолчанию (например, NONE/NOVA/ORION). Может быть null. */
  @Index()
  @Column({ type: 'int', name: 'tariff_id', nullable: true })
  tariffId!: number | null;

  @ManyToOne(() => Tariff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tariff_id' })
  tariff?: Tariff | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: UserStatus;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, select: false })
  apiKeyHash!: string;

  @Column({ type: 'text', select: false })
  apiKeyEnc!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  /** Последний визит с действующей сессией (вход по паролю или по cookie). */
  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  softId!: string | null;

  @OneToMany(() => Referral, (r) => r.referrer)
  sentReferrals: Referral[];

  @OneToOne(() => Referral, (r) => r.invitee)
  receivedReferral: Referral;

  @Column({ type: 'varchar', length: 64, unique: true, nullable: true })
  referralCode: string | null;
}
