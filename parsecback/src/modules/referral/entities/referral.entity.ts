// src/entities/referral.entity.ts
import { User } from '@/modules/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.sentReferrals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrerId' })
  referrer: User;

  @ManyToOne(() => User, (user) => user.receivedReferral, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'inviteeId' })
  invitee: User | null;

  @Column({ type: 'varchar', length: 64 })
  referralCode: string; // Промокод реферала

  @Column({ type: 'varchar', length: 255, nullable: true })
  inviteeEmail: string; // Email приглашённого

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  bonusAmount: number | null; // Бонус (для обоих)

  @Column({ type: 'boolean', default: false })
  bonusGiven: boolean; // Выдан ли бонус

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  bonusGivenAt: Date | null;
}
