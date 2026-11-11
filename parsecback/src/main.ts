import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { isStubMode, stopBackgroundTasks } from './common/stub-mode';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
// import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
// import { PublicXmlGlobalFilter } from './common/filters/public-xml-global.filter';

function parseOrigins(list: string | undefined): URL[] {
  if (!list) return [];
  const raw = list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const urls: URL[] = [];
  for (const item of raw) {
    // ожидаем полные origin-строки вида http(s)://host[:port]
    // если кто-то передал просто host — пропустим (чтобы не тянуть any)
    if (!/^https?:\/\//i.test(item)) continue;
    try {
      urls.push(new URL(item));
    } catch {
      // некорректный формат — игнорируем
    }
  }
  return urls;
}

function isAllowedOrigin(origin: string | undefined, allowed: URL[]): boolean {
  if (!origin) return true; // non-browser/same-origin
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }

  // Точное совпадение (включая порт)
  if (
    allowed.some(
      (a) =>
        a.protocol === u.protocol &&
        a.hostname === u.hostname &&
        a.port === u.port,
    )
  ) {
    return true;
  }
  // Совпадение по protocol+hostname, если в allow нет порта (т.е. пустая строка)
  if (
    allowed.some(
      (a) =>
        a.protocol === u.protocol && a.hostname === u.hostname && a.port === '',
    )
  ) {
    return true;
  }
  return false;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const logger: LogLevel[] = isProduction
    ? ['log', 'warn', 'error', 'fatal']
    : ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'];
  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger });
  const cfg = app.get(ConfigService);

  app.enableShutdownHooks();
  const httpAccessLogEnabled = parseBoolean(
    cfg.get<string>('HTTP_ACCESS_LOG_ENABLED'),
    !isProduction,
  );
  if (httpAccessLogEnabled) {
    app.useGlobalInterceptors(new HttpLoggingInterceptor());
  }
  {
    const inst = app.getHttpAdapter().getInstance() as unknown;
    const maybeHasSet = inst as { set?: unknown };
    if (typeof maybeHasSet.set === 'function') {
      (maybeHasSet.set as (k: string, v: unknown) => void)('trust proxy', 1);
    }
  }

  // Безопасность и куки
  app.use(helmet());
  app.use(cookieParser());

  // app.useGlobalFilters(app.get(AllExceptionsFilter));

  const origins = parseOrigins(cfg.get<string>('CORS_ORIGINS'));

  const corsOptions: CorsOptions = {
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ): void => {
      if (isAllowedOrigin(requestOrigin, origins)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-API-KEY',
      'x-api-key',
      'Accept',
      'Origin',
    ],
    maxAge: 86400,
  };

  app.enableCors(corsOptions);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  // Префикс API:
  // app.setGlobalPrefix('v1');

  const port = Number(cfg.get('PORT')) || 3000;
  await app.init();
  if (isStubMode(cfg)) {
    const counts = stopBackgroundTasks(app.get(SchedulerRegistry));
    Logger.log(
      `STUB_MODE: фоновые задачи остановлены (${counts.cron} cron, ${counts.interval} interval, ${counts.timeout} timeout)`,
      'Bootstrap',
    );
  }
  await app.listen(port);
}
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
