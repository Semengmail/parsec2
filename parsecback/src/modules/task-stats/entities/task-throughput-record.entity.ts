// src/modules/task-stats/entities/task-throughput-record.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

export type ThroughputPeriod = 'all_time' | 'day' | 'week' | 'month';

@Entity('task_throughput_record')
@Index(['server', 'searchEngine', 'period'], { unique: true })
export class TaskThroughputRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  server!: string;

  @Column({ type: 'varchar', length: 32 })
  searchEngine!: string;

  @Column({ type: 'varchar', length: 16 })
  period!: ThroughputPeriod;

  /** час, который дал рекорд */
  @Column({ type: 'timestamptz' })
  hour!: Date;

  /** значение рекорда */
  @Column({ type: 'float' })
  pagesPerSec!: number;

  @Column({ type: 'int' })
  totalPages!: number;

  @Column({ type: 'int' })
  activeMinutes!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  computedAt!: Date;
}
