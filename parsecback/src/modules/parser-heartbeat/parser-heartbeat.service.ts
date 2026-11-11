// src/modules/parser-heartbeat/parser-heartbeat.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ParserHeartbeat } from './entities/parser-heartbeat.entity';
import { AlertingService } from '@/shared/alerting/alerting.service';

@Injectable()
export class ParserHeartbeatService {
  private readonly logger = new Logger(ParserHeartbeatService.name);

  private readonly OFFLINE_THRESHOLD_MINUTES = 15;

  constructor(
    @InjectRepository(ParserHeartbeat)
    private readonly repo: Repository<ParserHeartbeat>,
    private readonly alerting: AlertingService,
  ) {}

  async receiveHeartbeat(parser: string, server: string) {
    const now = new Date();

    let record = await this.repo.findOne({
      where: { parser, server },
    });

    if (!record) {
      record = this.repo.create({
        parser,
        server,
        lastPingAt: now,
        isOffline: false,
        offlineNotifiedAt: null,
      });
    } else {
      // если был оффлайн → восстановился
      if (record.isOffline) {
        this.sendTelegramAlert(
          `✅ Parser ${parser} (server ${server}) восстановился`,
        );
        record.isOffline = false;
        record.offlineNotifiedAt = null;
      }

      record.lastPingAt = now;
    }

    await this.repo.save(record);
  }

  @Cron('*/5 * * * *') // каждые 5 минут
  async checkHeartbeats() {
    this.logger.debug('Проверка активности парсеров...');
    const thresholdDate = new Date(
      Date.now() - this.OFFLINE_THRESHOLD_MINUTES * 60 * 1000,
    );

    const staleParsers = await this.repo.find({
      where: {
        lastPingAt: LessThan(thresholdDate),
      },
    });

    for (const parser of staleParsers) {
      if (!parser.isOffline) {
        parser.isOffline = true;
        parser.offlineNotifiedAt = new Date();

        this.sendTelegramAlert(
          `🚨 Parser ${parser.parser} (server ${parser.server}) не проявляет активность уже более ${this.OFFLINE_THRESHOLD_MINUTES} минут`,
        );

        await this.repo.save(parser);
      }
    }
  }

  private sendTelegramAlert(msg: string) {
    this.alerting.safeCritical('Проверка работоспособности', msg);
  }
}
