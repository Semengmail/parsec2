// src/modules/test-bench/entities/test-bench-phrase.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export type TestBenchPhraseType = 'speed' | 'position' | 'selector';
export type TestBenchPhraseEngine = 'yandex' | 'google';

@Entity('test_bench_phrases')
@Index(['active'])
export class TestBenchPhrase {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  phrase!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  /** произвольные теги/метки, если пригодится для подвыборок */
  @Column({ type: 'text', array: true, nullable: true })
  tags!: string[] | null;

  /** тип фразы: speed / position / selector */
  @Column({
    type: 'varchar',
    length: 16,
    default: 'speed',
  })
  type!: TestBenchPhraseType;

  /**
   * Ограничение по ПС:
   * - 'yandex' — использовать только в Яндекс-тестах,
   * - 'google' — только в Google-тестах,
   * - null — годится для обоих.
   */
  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  searchEngine!: TestBenchPhraseEngine | null;
}
