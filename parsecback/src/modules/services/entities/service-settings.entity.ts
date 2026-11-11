import { Entity, PrimaryGeneratedColumn, Column, Unique, Index } from 'typeorm';
import type { ServiceCode } from '@/modules/tariffs/tariff.constants';

export type ServiceSettingsValue = {
  // универсальные поля, дополняемые в будущем
  device?: 'desktop' | 'mobile';
  lr?: number;
  latitude?: number | null;
  longitude?: number | null;
  // future: dailyLimit?: number;
};

@Entity('service_settings')
@Unique(['userId', 'service'])
export class ServiceSettings {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  userId!: number;

  @Column({ type: 'varchar', length: 32 })
  service!: ServiceCode;

  @Column({ type: 'jsonb', default: {} })
  settings!: ServiceSettingsValue;
}
