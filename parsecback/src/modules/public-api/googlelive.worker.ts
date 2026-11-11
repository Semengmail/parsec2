// src/modules/public-api/googlelive.worker.ts
import { Interval } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { GoogleLiveService } from './googlelive.service';
import { PublicApiPauseService } from './public-api-pause.service';

@Injectable()
export class GoogleLiveWorker {
  private readonly log = new Logger(GoogleLiveWorker.name);
  private pushing = false;
  private polling = false;

  constructor(
    private readonly svc: GoogleLiveService,
    private readonly pause: PublicApiPauseService,
  ) {}

  // отправляем задачи в ранк-скан (плавно, внутри svc есть пейсинг)
  @Interval(500)
  async push(): Promise<void> {
    if (this.pushing) return;
    this.pushing = true;
    try {
      const state = await this.pause.getState();

      const onlyUserId = state.paused ? state.allowUserId : null;

      await this.svc.pushQueued(50, { onlyUserId });
      // const n = await this.svc.pushQueued(50);
      // if (n > 0) this.log.debug(`pushed ${n} tasks`);
    } catch (e) {
      this.log.error(`push() failed: ${(e as Error).message}`);
    } finally {
      this.pushing = false;
    }
  }

  // опрашиваем статусы
  @Interval(500)
  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const n = await this.svc.pollSent(100);
      if (n > 0) this.log.debug(`completed ${n} tasks`);
    } catch (e) {
      this.log.error(`poll() failed: ${(e as Error).message}`);
    } finally {
      this.polling = false;
    }
  }
}
