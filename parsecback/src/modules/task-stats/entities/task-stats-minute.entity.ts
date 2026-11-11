import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Compact source for the last two days of exact per-minute throughput. */
@Entity('task_stats_minute')
@Index(['searchEngine', 'device', 'periodStart'], { unique: true })
@Index(['periodStart'])
export class TaskStatsMinute {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'timestamptz' })
  periodStart!: Date;

  @Column({ type: 'varchar', length: 32 })
  searchEngine!: string;

  @Column({ type: 'varchar', length: 16 })
  device!: 'desktop' | 'mobile';

  @Column({ type: 'int' })
  totalPages!: number;
}
