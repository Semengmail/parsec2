// src/shared/utils/fire-and-forget.ts
import { Logger } from '@nestjs/common';

const logger = new Logger('FireAndForget');

export function fireAndForget<T>(
  promise: Promise<T>,
  context: string,
  timeoutMs = 5000,
): void {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout exceeded')), timeoutMs),
  );

  Promise.race([promise, timeout]).catch((err) => {
    logger.warn(`[${context}] async task failed: ${err?.message}`);
  });
}
