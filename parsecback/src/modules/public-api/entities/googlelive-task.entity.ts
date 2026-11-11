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

  pubDate?: string | null;
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

@Entity('public_googlelive_tasks')
@Index(['userId', 'status'])
export class GoogleLiveTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column({ type: 'varchar', length: 2048 })
  query!: string;

  @Column({ type: 'int' })
  lr!: number;

  @Column({ type: 'text', nullable: true })
  cityName!: string | null;

  @Column({ type: 'varchar', length: 16 })
  device!: 'desktop' | 'mobile';

  @Column({ type: 'int', default: 1 })
  page!: number;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ type: 'text', nullable: true, comment: 'Google UULE (a+<base64>)' })
  uule!: string | null;

  /** id задачи во внешнем ранк-скане */
  @Column({ type: 'int', nullable: true })
  externalTaskId!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'QUEUED' })
  status!: ProxyTaskStatus;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  // ===== Новые входные параметры (все опциональны) =====

  /** 10..100 шаг 10 */
  @Column({ type: 'int', nullable: true })
  groupby!: number | null;

  /** доменная зона ('ru','com','com.ua'...) */
  @Column({ type: 'text', nullable: true })
  domain!: string | null;

  /** numeric id домена (как в HTML data-id), если есть */
  @Column({ type: 'int', nullable: true })
  domainId!: number | null;

  /** tbm: '', 'images', 'video' */
  @Column({ type: 'text', nullable: true, comment: "'' | 'images' | 'video'" })
  tbm!: '' | 'images' | 'video' | null;

  /** tbs: '', 'qdr:h','qdr:d','qdr:w','qdr:m','qdr:y' */
  @Column({
    type: 'text',
    nullable: true,
    comment: "'' | 'qdr:h' | 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y'",
  })
  tbs!: '' | 'qdr:h' | 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y' | null;

  /** hl — язык интерфейса */
  @Column({ type: 'text', nullable: true })
  hl!: string | null;

  /** gl — страна поиска */
  @Column({ type: 'varchar', length: 2, nullable: true })
  gl: string | null;

  /** флаги */
  @Column({ type: 'boolean', nullable: true, default: false })
  ads!: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  related!: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  video!: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  filter!: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  punycode!: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  hlword!: boolean | null;

  /** delayed есть в DTO, но для Google практической роли нет — оставим для унификации */
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
