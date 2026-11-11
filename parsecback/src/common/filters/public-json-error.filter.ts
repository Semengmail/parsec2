import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { mapToXmlStockError } from '@/common/errors/map-xmlstock-error';

// @Catch()
// export class PublicJsonErrorFilter implements ExceptionFilter {
//   catch(exception: unknown, host: ArgumentsHost) {
//     const ctx = host.switchToHttp();
//     const res: Response = ctx.getResponse();

//     const { code, message } = mapToXmlStockError(exception);

//     res.status(200).json({
//       status: 'error',
//       code,
//       error: message,
//     });
//   }
// }
@Catch()
export class PublicJsonErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res: Response = ctx.getResponse();

    // ✅ 1. Если это уже ApiErrorResponse — отдаем как есть
    if (
      exception &&
      typeof exception === 'object' &&
      'status' in exception &&
      (exception as any).status === 'error' &&
      'code' in exception &&
      'error' in exception
    ) {
      res.status(200).json(exception);
      return;
    }

    // ❗ 2. Только реальные исключения маппим
    const { code, message } = mapToXmlStockError(exception);

    res.status(200).json({
      status: 'error',
      code,
      error: message,
    });
  }
}
