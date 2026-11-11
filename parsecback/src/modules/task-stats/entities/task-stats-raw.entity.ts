import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('task_stats_raw')
@Index(['server', 'searchEngine', 'createdAt'])
@Index(['searchEngine', 'sourceTaskId', 'server'], { unique: true })
export class TaskStatsRaw {
  @PrimaryGeneratedColumn()
  id!: number;

  /** googlelive / yandexlive */
  @Column({ type: 'varchar', length: 32 })
  searchEngine!: string;

  /** имя/хост сервера (node-бота) */
  @Column({ type: 'varchar', length: 64 })
  server!: string;

  /** Id задачи Parsec: защита от повторного учёта при повторном polling. */
  @Column({ type: 'int', nullable: true })
  sourceTaskId!: number | null;

  /** время выполнения (мс) */
  @Column({ type: 'int' })
  durationMs!: number;

  /** сколько страниц собрано (чаще всего 1, но может >1 для groupby) */
  @Column({ type: 'int', default: 1 })
  pages!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'float', default: 0 })
  pagesPerSec!: number;
}
