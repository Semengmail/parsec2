import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GlobalLimitsValue = {
  globalMaxInFlight: number;
  maxQueuedPerEngine: number;
  services: {
    yandexLive: {
      userRequestLimit: number;
      adminRequestLimit: number;
    };
    googleLive: {
      userRequestLimit: number;
      adminRequestLimit: number;
    };
    yandexXml: {
      userRequestLimit: number;
      adminRequestLimit: number;
    };
    frequency: {
      userRequestLimit: number;
      adminRequestLimit: number;
    };
  };
};

@Entity('global_limits_settings')
export class GlobalLimitsSettings {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'jsonb' })
  settings!: GlobalLimitsValue;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
