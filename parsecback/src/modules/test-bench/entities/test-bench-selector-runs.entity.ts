import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SelectorRunTaskIds = {
  yandex: number[];
  google: number[];
};

@Entity('test_bench_selector_runs')
export class TestBenchSelectorRun {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'boolean', nullable: true })
  yandexNoResOk: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  yandexHasResOk: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  googleNoResOk: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  googleHasResOk: boolean | null;

  @Column({ type: 'boolean', default: false })
  completed!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  taskIds!: SelectorRunTaskIds | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;
}
