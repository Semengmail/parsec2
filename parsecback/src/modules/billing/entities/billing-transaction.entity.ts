// src/modules/billing/entities/billing-transaction.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import type { ServiceCode } from '../../tariffs/tariff.constants';

export type BillingSource = 'USER_BALANCE' | 'USER_TARIFF';
export type BillingKind = 'DEBIT' | 'CREDIT';
export type BillingState = 'POSTED' | 'REFUNDED'; // ← добавили

@Entity('billing_transactions')
@Index(['userId', 'createdAt'])
export class BillingTransaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column({ type: 'int', nullable: true })
  userTariffId!: number | null;

  @Column({ type: 'varchar', length: 16 })
  kind!: BillingKind;

  @Column({ type: 'varchar', length: 16 })
  source!: BillingSource;

  @Column({ type: 'varchar', length: 32, nullable: true })
  service!: ServiceCode | null;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  @Column({ type: 'bigint', default: 0 })
  unitPrice!: string;

  /** Сумма операции в тысячных рубля: DEBIT — отрицательная, CREDIT — положительная */
  @Column({ type: 'bigint' })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta!: Record<string, unknown> | null;

  /** Статус транзакции (для оригиналов ставим REFUNDED при возврате) */
  @Column({ type: 'varchar', length: 16, default: 'POSTED' })
  state!: BillingState;

  /** Если это рефанд — указываем ID исходной транзакции */
  @Index()
  @Column({ type: 'int', nullable: true })
  refundOfTxId!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  softId!: string | null;
}
