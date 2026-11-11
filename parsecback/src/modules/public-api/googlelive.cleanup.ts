// src/modules/public-api/googlelive.cleanup.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { GoogleLiveTask } from './entities/googlelive-task.entity';

@Injectable()
export class GoogleLiveCleanupService {
  constructor(
    @InjectRepository(GoogleLiveTask)
    private readonly repo: Repository<GoogleLiveTask>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(): Promise<void> {
    const now = Date.now();

    // COMPLETED/ERROR старше 3 дней — удаляем
    const cutoffCompleted = new Date(now - 3 * 24 * 60 * 60 * 1000);
    await this.repo.delete({
      status: 'COMPLETED',
      completedAt: LessThan(cutoffCompleted),
    });
    await this.repo.delete({
      status: 'ERROR',
      updatedAt: LessThan(cutoffCompleted),
    });

    // SENT/QUEUED старше 12 часов — считаем протухшими → удаляем
    const cutoffStuck = new Date(now - 12 * 60 * 60 * 1000);
    await this.repo
      .createQueryBuilder()
      .delete()
      .from(GoogleLiveTask)
      .where('status IN (:...st)', { st: ['SENT', 'QUEUED'] })
      .andWhere('"createdAt" < :cut', { cut: cutoffStuck.toISOString() })
      .execute();
  }
}
