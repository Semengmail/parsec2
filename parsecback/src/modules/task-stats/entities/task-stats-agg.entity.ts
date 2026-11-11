// src/modules/task-stats/entities/task-stats-agg.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('task_stats_day')
@Index(['server', 'searchEngine', 'periodStart'], { unique: true })
export class TaskStatsDay {
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

@Entity('task_stats_week')
@Index(['server', 'searchEngine', 'periodStart'], { unique: true })
export class TaskStatsWeek {
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

@Entity('task_stats_month')
@Index(['server', 'searchEngine', 'periodStart'], { unique: true })
export class TaskStatsMonth {
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
