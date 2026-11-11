// src/modules/frequency/entities/frequency-task.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FrequencyChunk } from './frequency-chunk.entity';
import type { FrequencyTypeId } from '../frequency.constants';

export type FrequencyTaskType = 'frequency' | 'wordstat';
export type FrequencyTaskStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'ERROR';

@Entity({ name: 'frequency_tasks', schema: 'public' })
export class FrequencyTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  userId!: number;

  @Column({ type: 'varchar', length: 32 })
  type!: FrequencyTaskType;

  @Column({ type: 'int', default: 225 })
  city!: number;

  @Column({ type: 'jsonb' })
  phrases!: string[];

  @Column({ type: 'jsonb', nullable: true })
  minusWords!: string[] | null;

  @Column({ type: 'boolean', default: false })
  yearlyFrequency!: boolean;

  @Column({ type: 'int', array: true })
  frequencyTypes!: FrequencyTypeId[];

  @Column({ type: 'int', default: 0 })
  chunksTotal!: number;

  @Column({ type: 'int', default: 0 })
  chunksCompleted!: number;

  @Column({ type: 'varchar', length: 16, default: 'QUEUED' })
  status!: FrequencyTaskStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resultFetchedAt!: Date | null;

  @OneToMany(() => FrequencyChunk, (c) => c.task, { cascade: true })
  chunks!: FrequencyChunk[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  softId!: string | null;
}
