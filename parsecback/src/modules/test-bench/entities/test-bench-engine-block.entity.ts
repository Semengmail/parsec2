import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('test_bench_engine_block')
export class TestBenchEngineBlock {
  @PrimaryColumn()
  engine: 'yandex' | 'google';

  @Column({ default: false })
  blocked: boolean;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
