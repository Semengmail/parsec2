import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { CronJob } from 'cron';
import axios from 'axios';
import { AlertingService } from '../shared/alerting/alerting.service';
import { TelegramService } from '../modules/telegram/telegram.service';
import { MailService } from '../modules/mail/mail.service';
import { isStubMode, stopBackgroundTasks } from './stub-mode';

describe('STUB_MODE', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([undefined, false, 'false', '', '1'])(
    'defaults off for %s',
    (value) => {
      expect(isStubMode(new ConfigService({ STUB_MODE: value }))).toBe(false);
    },
  );

  it.each([true, 'true', ' TRUE '])('enables for %s', (value) => {
    expect(isStubMode(new ConfigService({ STUB_MODE: value }))).toBe(true);
  });

  it('stops real cron, interval and timeout handles before they can execute', () => {
    jest.useFakeTimers();
    const registry = new SchedulerRegistry();
    const tick = jest.fn();
    const cron = new CronJob<null, null>('* * * * * *', tick, null, true);
    registry.addCronJob('cron', cron);
    registry.addInterval('interval', setInterval(tick, 10));
    registry.addTimeout('timeout', setTimeout(tick, 10));
    expect(stopBackgroundTasks(registry)).toEqual({
      cron: 1,
      interval: 1,
      timeout: 1,
    });
    jest.advanceTimersByTime(120_000);
    expect(tick).not.toHaveBeenCalled();
    expect(registry.getIntervals()).toEqual([]);
    expect(registry.getTimeouts()).toEqual([]);
    registry.deleteCronJob('cron');
  });

  it('suppresses all alert channels without requiring alert recipients', () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const telegram = { sendMessage: jest.fn(), sendAlert: jest.fn() };
    const mail = { sendAlert: jest.fn(), sendCritical: jest.fn() };
    const service = new AlertingService(
      telegram as unknown as TelegramService,
      mail as unknown as MailService,
      new ConfigService({ STUB_MODE: 'true' }),
    );
    service.notify('notification');
    service.alert('warning', 'text');
    service.critical('critical', 'text');
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(telegram.sendAlert).not.toHaveBeenCalled();
    expect(mail.sendAlert).not.toHaveBeenCalled();
    expect(mail.sendCritical).not.toHaveBeenCalled();
  });

  it('suppresses Telegram even with production credentials', () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const post = jest.fn();
    jest.spyOn(axios, 'create').mockReturnValue({ post } as never);
    const service = new TelegramService(
      new ConfigService({
        STUB_MODE: 'true',
        NODE_ENV: 'production',
        TELEGRAM_BOT_TOKEN: 'test',
        TELEGRAM_CHAT_ID: 'test',
      }),
    );
    service.sendMessage('text');
    service.sendAlert('text');
    service.sendTestBenchResult('text');
    expect(post).not.toHaveBeenCalled();
  });
});
