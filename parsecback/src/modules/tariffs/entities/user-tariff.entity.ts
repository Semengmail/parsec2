import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type UserTariffStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

@Entity('user_tariffs')
@Index(['userId', 'status'])
export class UserTariff {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column()
  tariffId!: number;

  /** Баланс тарифа (миллирубли), тратится по ставкам тарифа */
  @Column({ type: 'bigint', default: 0 })
  balance!: string;

  /** Дата начала / окончания действия */
  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status!: UserTariffStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
