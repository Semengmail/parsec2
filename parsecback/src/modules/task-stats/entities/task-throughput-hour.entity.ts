// src/modules/task-stats/entities/task-throughput-hour.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('task_throughput_hour')
@Index(['server', 'searchEngine', 'periodStart'], { unique: true })
export class TaskThroughputHour {
  @PrimaryGeneratedColumn()
  id!: number;

  /** начало часа */
  @Column({ type: 'timestamptz' })
  periodStart!: Date;

  @Column({ type: 'varchar', length: 32 })
  searchEngine!: string; // googlelive | yandexlive

  @Column({ type: 'varchar', length: 64 })
  server!: string;

  /** суммарно страниц за час */
  @Column({ type: 'int' })
  totalPages!: number;

  /** сколько разных минут было активно */
  @Column({ type: 'int' })
  activeMinutes!: number;

  /** валидный ли час (continuous load) */
  @Column({ type: 'boolean' })
  isContinuous!: boolean;

  /** реальная скорость за этот час */
  @Column({ type: 'float' })
  pagesPerSec!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
