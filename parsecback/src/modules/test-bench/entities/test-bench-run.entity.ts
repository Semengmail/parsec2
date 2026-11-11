// src/modules/test-bench/entities/test-bench-run.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('test_bench_runs')
export class TestBenchRun {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  engine!: 'yandex' | 'google';

  @Column({ nullable: true })
  device!: 'desktop' | 'mobile';

  @Column({ type: 'int' })
  top!: number;

  @Column({ type: 'int' })
  phrasesCount!: number;

  @Column({ type: 'int' })
  pagesPerTask!: number;

  @Column({ type: 'int' })
  totalPages!: number;

  @Column({ type: 'timestamp', default: () => 'now()' })
  startedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  durationMs!: string | null;

  @Column({ type: 'float', nullable: true })
  pagesPerMinute!: number | null;

  @Column({ type: 'boolean', default: false })
  interfered!: boolean;

  @Column({ type: 'int', default: 0 })
  maxForeignInFlight!: number;

  @Column({ type: 'int', default: 0 })
  completedCount!: number;

  @Column({ type: 'int', default: 0 })
  errorCount!: number;

  @Column({ type: 'int', array: true, nullable: true })
  taskIds!: number[] | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
