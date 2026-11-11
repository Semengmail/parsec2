// src/modules/tariffs/entities/tariff.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { TariffRate } from './tariff-rate.entity';

@Entity('tariffs')
export class Tariff {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: 'NONE' | 'NOVA' | 'ORION'; // можно расширять

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /** Срок действия покупок по умолчанию (дней) */
  @Column({ type: 'int', default: 30 })
  defaultDurationDays!: number;

  /** Требуемая сумма пополнения тарифа при покупке (миллирубли), например 3000 ₽ → '3000000' */
  @Column({ type: 'bigint', default: 0 })
  minDeposit!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => TariffRate, (r) => r.tariff, { cascade: true })
  rates!: TariffRate[];
}
