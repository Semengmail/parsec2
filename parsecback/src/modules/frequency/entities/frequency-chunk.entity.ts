// src/modules/frequency/entities/frequency-chunk.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FrequencyTask } from './frequency-task.entity';

export type FrequencyChunkStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'POLLING'
  | 'COMPLETED'
  | 'ERROR';

@Entity({ name: 'frequency_chunks', schema: 'public' })
export class FrequencyChunk {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  userId!: number;

  @Index()
  @Column({ type: 'int' })
  taskId!: number;

  @ManyToOne(() => FrequencyTask, (t) => t.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task!: FrequencyTask;

  @Column({ type: 'jsonb' })
  phrases!: string[];

  @Column({ type: 'int', nullable: true })
  externalTaskId!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'QUEUED' })
  status!: FrequencyChunkStatus;

  @Column({ type: 'varchar', length: 128, nullable: true })
  error!: string | null;

  @Column({ type: 'int', default: 0 })
  pollRetryCount!: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  nextPollAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  result!: any[] | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
