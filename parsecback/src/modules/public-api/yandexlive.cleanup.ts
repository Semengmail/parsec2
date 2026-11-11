import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { YandexLiveTask } from './entities/yandexlive-task.entity';

@Injectable()
export class YandexLiveCleanupService {
  constructor(
    @InjectRepository(YandexLiveTask)
    private readonly repo: Repository<YandexLiveTask>,
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
      // fallback на updatedAt, если нет completedAt
      updatedAt: LessThan(cutoffCompleted) as unknown as Date,
    });

    // SENT/QUEUED старше 12 часов — считаем протухшими → удаляем
    const cutoffStuck = new Date(now - 12 * 60 * 60 * 1000);
    await this.repo
      .createQueryBuilder()
      .delete()
      .from(YandexLiveTask)
      .where('status IN (:...st)', { st: ['SENT', 'QUEUED'] })
      .andWhere('"createdAt" < :cut', { cut: cutoffStuck.toISOString() })
      .execute();
  }
}
