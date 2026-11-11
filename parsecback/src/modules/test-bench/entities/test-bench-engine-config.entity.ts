import { Column, Entity, PrimaryColumn } from 'typeorm';
import * as testBenchCheckEntity from './test-bench-check.entity';

@Entity('test_bench_engine_config')
export class TestBenchEngineConfig {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  engine!: testBenchCheckEntity.TestBenchCheckEngine; // 'yandex' | 'google'

  /** ----- ОБЩИЕ НАСТРОЙКИ ----- */

  @Column({ type: 'boolean', default: true })
  autoblockEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  autoblockSelectors!: boolean;

  @Column({ type: 'boolean', default: true })
  autoblockPositionsJump!: boolean;

  @Column({ type: 'boolean', default: true })
  autoblockPositionsMissing!: boolean;

  @Column({ type: 'boolean', default: true })
  telegramAlertsEnabled!: boolean;

  /** ----- ПОРГИ ----- */

  @Column({ type: 'int', default: 10 })
  positionJumpDiffWarning!: number;

  @Column({ type: 'int', default: 1 })
  maxMissingPositionsPerRun!: number;

  /** ----- POSITION TEST ----- */

  @Column({ type: 'varchar', length: 255, default: 'implantolog-fedorov.ru' })
  positionTestSite!: string;

  @Column({ type: 'int', default: 10 })
  positionTestLimit!: number;

  /** ----- SPEED TEST ----- */

  @Column({ type: 'int', default: 100 })
  speedTestLimit!: number;

  /** ----- CAPTCHA METRICS CRITERIA ----- */

  /** Порог по avgNonZero */
  @Column({ type: 'float', default: 0 })
  captchaAvgNonZeroLimitDesktop!: number;

  @Column({ type: 'float', default: 0 })
  captchaAvgNonZeroLimitMobile!: number;

  /** Порог по проценту нулевых капч */
  @Column({ type: 'float', default: 0 })
  captchaZeroPercentLimitDesktop!: number;

  @Column({ type: 'float', default: 0 })
  captchaZeroPercentLimitMobile!: number;

  /** включение/выключение нотификаций по этим критериям */
  @Column({ type: 'boolean', default: false })
  captchaAlertsEnabled!: boolean;

  /** Расписания cron-времён (например ["07:00","20:00"]) */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  captchaScheduleTimes!: string[];

  @Column({ type: 'float', default: 0 })
  captchaAvgNonZeroMinDesktop!: number;

  @Column({ type: 'float', default: 0 })
  captchaAvgNonZeroMinMobile!: number;

  @Column({ type: 'boolean', default: false })
  captchaMinAvgAlertEnabled!: boolean;
}
