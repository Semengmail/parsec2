// src/modules/test-bench/entities/test-bench-position.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TestBenchPhrase } from './test-bench-phrase.entity';

export type TestBenchPositionEngine = 'yandex' | 'google';
export type TestBenchPositionDevice = 'desktop' | 'mobile';

@Entity('test_bench_positions')
export class TestBenchPosition {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Время конкретного сбора (можно = finishedAt прогона или now()) */
  @Column({ type: 'timestamptz' })
  collectedAt!: Date;

  @Column({ type: 'varchar', length: 16 })
  engine!: TestBenchPositionEngine;

  @Column({ type: 'varchar', length: 16 })
  device!: TestBenchPositionDevice;

  @ManyToOne(() => TestBenchPhrase, { nullable: false })
  @JoinColumn({ name: 'phraseId' })
  phrase!: TestBenchPhrase;

  @Column()
  phraseId!: number;

  @Column({ type: 'text' })
  phraseText!: string;

  /** Тестируемый сайт (сейчас implantolog-fedorov.ru) */
  @Column({ type: 'text' })
  site!: string;

  /**
   * Позиция сайта:
   * - 1..N — реальная позиция,
   * - null — сайт не найден в пределах собранного топа.
   */
  @Column({ type: 'int', nullable: true })
  position!: number | null;
}
