// src/modules/test-bench/entities/test-bench-check.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TestBenchPhrase } from './test-bench-phrase.entity';

export type TestBenchCheckEngine = 'yandex' | 'google';
export type TestBenchCheckDevice = 'desktop' | 'mobile';

export type TestBenchCheckType =
  | 'positions_timeout' // 1) не уложились в 15мин
  | 'selectors_no_results' // 2а) кейс "нет результатов"
  | 'selectors_has_results' // 2б) кейс "есть результаты"
  | 'selectors_url_selector_bad' // 2в) селектор урла не найден/сломался
  | 'position_site_missing' // 3) сайт выпал из топ-5
  | 'position_jump' // 4) скачок позиции >= 10
  | 'positions_missing_many';

export type TestBenchCheckLevel = 'info' | 'warning' | 'error';

@Entity('test_bench_checks')
export class TestBenchCheck {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 16 })
  engine!: TestBenchCheckEngine;

  @Column({ type: 'varchar', length: 16 })
  device!: TestBenchCheckDevice;

  @Column({ type: 'varchar', length: 32 })
  type!: TestBenchCheckType;

  @Column({ type: 'boolean' })
  ok!: boolean;

  @Column({ type: 'varchar', length: 16, default: 'info' })
  level!: TestBenchCheckLevel;

  @Column({ type: 'text' })
  message!: string;

  @ManyToOne(() => TestBenchPhrase, { nullable: true })
  @JoinColumn({ name: 'phraseId' })
  phrase!: TestBenchPhrase | null;

  @Column({ type: 'int', nullable: true })
  phraseId!: number | null;

  @Column({ type: 'text', nullable: true })
  phraseText!: string | null;

  /** Произвольные доп. данные — позиции до/после и т.д. */
  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;
}
