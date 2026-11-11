import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('task_stats_hour')
@Index(['server', 'searchEngine', 'periodStart'], { unique: true })
export class TaskStatsHour {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'timestamptz' })
  periodStart!: Date;

  @Column({ type: 'varchar', length: 32 })
  searchEngine!: string;

  @Column({ type: 'varchar', length: 64 })
  server!: string;

  @Column({ type: 'int' })
  totalPages!: number;

  @Column({ type: 'float' })
  avgDurationSec!: number;

  @Column({ type: 'float', default: 0 })
  pagesPerSec!: number;
}
