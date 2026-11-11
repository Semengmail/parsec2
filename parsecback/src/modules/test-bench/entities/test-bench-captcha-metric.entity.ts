import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

export type CaptchaEngine = 'yandex' | 'google';
export type CaptchaDevice = 'desktop' | 'mobile';

@Entity('test_bench_captcha_metrics')
@Index(['serverId', 'engine', 'device', 'collectedAt'])
export class TestBenchCaptchaMetric {
  @PrimaryGeneratedColumn()
  id!: number;

  /** ID сервера RankScan (string, может быть Y1 / R2 / G5 ...) */
  @Column({ type: 'varchar', length: 64 })
  serverId!: string;

  @Column({ type: 'varchar', length: 16 })
  engine!: CaptchaEngine;

  @Column({ type: 'varchar', length: 16 })
  device!: CaptchaDevice;

  /** Кол-во нулевых капч (absolute) */
  @Column({ type: 'int' })
  zeroCaptchaCount!: number;

  /** Среднее значение по всем значениям RankScan (как прислали) */
  @Column({ type: 'float' })
  avgTotal!: number;

  /** Среднее значение чисто по тем значениям, где value > 0 */
  @Column({ type: 'float' })
  avgNonZero!: number;

  /** Всего сборов по этому серверу/движку/девайсу */
  @Column({ type: 'int' })
  samplesTotal!: number;

  /** Сколько из них — НЕ нулевые */
  @Column({ type: 'int' })
  samplesNonZero!: number;

  /** Процент нулевых капч (0–100) */
  @Column({ type: 'float' })
  zeroPercent!: number;

  /**
   * Гистограмма вида:
   *   { "1": 2, "2": 5, "7": 10 }
   * ключ = число капч до первой капчи
   */
  @Column({ type: 'jsonb' })
  histogram!: Record<string, number>;

  /** Дата/время сбора данных */
  @Column({ type: 'timestamptz' })
  collectedAt!: Date;

  /** createdAt записи в таблице */
  @CreateDateColumn()
  createdAt!: Date;
}
