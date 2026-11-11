import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

export function isStubMode(config: ConfigService): boolean {
  return (
    String(config.get<string | boolean>('STUB_MODE', false))
      .trim()
      .toLowerCase() === 'true'
  );
}

export function stopBackgroundTasks(registry: SchedulerRegistry): {
  cron: number;
  interval: number;
  timeout: number;
} {
  const jobs = registry.getCronJobs();
  const intervals = registry.getIntervals();
  const timeouts = registry.getTimeouts();
  for (const job of jobs.values()) void job.stop();
  for (const name of intervals) registry.deleteInterval(name);
  for (const name of timeouts) registry.deleteTimeout(name);
  return {
    cron: jobs.size,
    interval: intervals.length,
    timeout: timeouts.length,
  };
}
