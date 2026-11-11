import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Tariff } from './tariff.entity';
import type { ServiceCode } from '../tariff.constants';

@Entity('tariff_rates')
@Index(['tariffId', 'service'], { unique: true })
export class TariffRate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  tariffId!: number;

  @ManyToOne(() => Tariff, (t) => t.rates, { onDelete: 'CASCADE' })
  tariff!: Tariff;

  @Column({ type: 'varchar', length: 32 })
  service!: ServiceCode;

  /** Цена за единицу услуги в тысячных рубля (1 = 0.001 ₽) */
  @Column({ type: 'bigint' })
  unitPrice!: string;

  /** (Опционально на будущее) лимит единиц на срок тарифа */
  @Column({ type: 'int', nullable: true })
  limitUnits!: number | null;
}
