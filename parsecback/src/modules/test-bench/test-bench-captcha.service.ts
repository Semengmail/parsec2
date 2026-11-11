import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestBenchCaptchaMetric } from './entities/test-bench-captcha-metric.entity';

@Injectable()
export class TestBenchCaptchaService {
  private readonly log = new Logger(TestBenchCaptchaService.name);

  constructor(
    @InjectRepository(TestBenchCaptchaMetric)
    private readonly repo: Repository<TestBenchCaptchaMetric>,
  ) {}

  /** Сохранить один набор данных */
  async saveMetric(
    data: Omit<TestBenchCaptchaMetric, 'id' | 'createdAt'>,
  ): Promise<void> {
    const row = this.repo.create(data);
    await this.repo.save(row);
  }

  /** Очистка данных старше 30 дней */
  async cleanupOld(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await this.repo
      .createQueryBuilder()
      .delete()
      .where('"collectedAt" < :cutoff', { cutoff })
      .execute();
  }

  /** Получить данные за период */
  async getMetrics(params: { from?: Date; to?: Date; serverId?: string }) {
    const qb = this.repo
      .createQueryBuilder('m')
      .orderBy('m.collectedAt', 'DESC');

    if (params.from)
      qb.andWhere('m.collectedAt >= :from', { from: params.from });
    if (params.to) qb.andWhere('m.collectedAt <= :to', { to: params.to });
    if (params.serverId)
      qb.andWhere('m.serverId = :sid', { sid: params.serverId });

    return qb.getMany();
  }

  async deleteMetricsByServer(serverId: string): Promise<number> {
    const result = await this.repo.delete({ serverId });
    return result.affected ?? 0;
  }
}
