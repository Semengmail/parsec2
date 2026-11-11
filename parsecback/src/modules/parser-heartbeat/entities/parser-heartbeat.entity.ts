// src/modules/parser-heartbeat/entities/parser-heartbeat.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('parser_heartbeat')
@Index(['parser', 'server'], { unique: true })
export class ParserHeartbeat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  parser: string;

  @Column({ type: 'varchar', length: 50 })
  server: string;

  @Column({ type: 'timestamptz' })
  lastPingAt: Date;

  @Column({ type: 'boolean', default: false })
  isOffline: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  offlineNotifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
