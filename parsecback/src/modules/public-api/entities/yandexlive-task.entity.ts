import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProxyTaskStatus =
  | 'QUEUED'
  | 'SENT'
  | 'COMPLETED'
  | 'ERROR'
  | 'POLLING'
  | 'SENDING';

/**
 * Дополнительные поля результата одной позиции
 * (расширяем назад-совместимо — старые клиенты видят только {position,url,site?,title?})
 */
export type SerpResultExtras = {
  snippet?: string | null;
  breadcrumb?: string | null;
  sitelinks?: Array<{
    title?: string | null;
    url?: string | null;
    snippet?: string | null;
  }> | null;
  onelineSitelinks?: Array<{
    title?: string | null;
    url?: string | null;
    snippet?: string | null;
  }> | null;

  pubDate?: string | null; // ISO
  featuredSnippet?: {
    text?: string;
    url?: string;
    title?: string;
  } | null;
  knowledgePanel?: Record<string, unknown> | null;
  relatedQuestions?: string[] | null;
  passages?: string[] | null;
};

export type SerpResultItem = {
  position: number;
  url: string;
  site?: string | null;
  title?: string | null;
  extras?: SerpResultExtras | null;
};

@Entity('public_yandexlive_tasks')
@Index(['userId', 'status'])
export class YandexLiveTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column({ type: 'varchar', length: 2048 })
  query!: string;

  @Column({ type: 'int' })
  lr!: number;

  @Column({ type: 'varchar', length: 16 })
  device!: 'desktop' | 'mobile';

  @Column({ type: 'int', default: 1 })
  page!: number;

  /** id задачи во внешнем ранк-скане */
  @Column({ type: 'int', nullable: true })
  externalTaskId!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'QUEUED' })
  status!: ProxyTaskStatus;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  // ===== Новые входные параметры (все опциональны) =====

  /** 10..100 шаг 10; для YandexLive фактически 10, но храним для совместимости */
  @Column({ type: 'int', nullable: true })
  groupby!: number | null;

  /** доменная зона ('ru','by','kz','com.tr'...) */
  @Column({ type: 'text', nullable: true })
  domain!: string | null;

  /** numeric id домена (если используется) */
  @Column({ type: 'int', nullable: true })
  domainId!: number | null;

  /** tbm: '', 'images', 'video' */
  @Column({ type: 'text', nullable: true, comment: "'' | 'images' | 'video'" })
  tbm!: '' | 'images' | 'video' | null;

  /** флаг «похожие запросы» */
  @Column({ type: 'boolean', nullable: true, default: false })
  related!: boolean | null;

  /** punycode режим */
  @Column({ type: 'boolean', nullable: true, default: false })
  punycode!: boolean | null;

  /** подсветка слов */
  @Column({ type: 'boolean', nullable: true, default: false })
  hlword!: boolean | null;

  /** режим гибрид/асинхронный (Яндекс-специфика). По умолчанию true (гибрид). */
  @Column({ type: 'boolean', nullable: true, default: true })
  delayed!: boolean | null;

  // ===== Результаты и page-level extras =====

  @Column({ type: 'jsonb', nullable: true })
  results!: SerpResultItem[] | null;

  /** page-level extras: агрегированные данные (relatedQuestions, knowledgePanel, etc.) */
  @Column({ type: 'jsonb', nullable: true })
  extras!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  pollRetryCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  nextPollAt!: Date | null;

  /** Количество страниц, возвращённых RankScan (для groupby > 10) */
  @Column({ type: 'int', nullable: true })
  totalPages!: number | null;

  /** Флаг, что это последняя страница (RankScan: lastPage = true) */
  @Column({ type: 'boolean', nullable: true })
  lastPage!: boolean | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  softId!: string | null;
}
