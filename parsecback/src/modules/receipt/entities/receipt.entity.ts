import { Payment } from '@/modules/payment/entities/payment.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DKErrorResponse, DKReceiptResponse } from '../digitalkassa.types';

@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true })
  receiptId: string;

  @ManyToOne(() => Payment, (p) => p.receipts, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column()
  paymentId: number;

  @Column({ type: 'jsonb', nullable: true })
  response: DKReceiptResponse | DKErrorResponse | null;

  @Column({ type: 'varchar', nullable: true })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  fiscalSign: string;

  @Column({ type: 'varchar', nullable: true })
  fiscalNum: string;

  @Column({ type: 'varchar', nullable: true })
  receiptUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
