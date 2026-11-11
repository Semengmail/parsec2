import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentService } from './payment.service';
import { JwtCookieGuard } from '@/common/guards/jwt-cookie.guard';
import { ApiBody, ApiOkResponse, ApiOperation } from '@nestjs/swagger';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiOperation({ summary: 'Создать платёж на пополнение баланса' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiOkResponse({
    schema: { example: { paymentUrl: 'https://securepay.tinkoff.ru/...' } },
  })
  @UseGuards(JwtCookieGuard)
  @Post('create')
  createPayment(): never {
    throw new ServiceUnavailableException(
      'Пополнение временно недоступно: сервис на техническом обслуживании',
    );
  }

  @Post('callback')
  @HttpCode(200)
  async handleCallback(@Body() callbackData: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await this.paymentService.processWebhook(callbackData);
  }

  @Post('notify')
  @HttpCode(200)
  async notify(@Body() notificationData: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await this.paymentService.processWebhook(notificationData);
  }

  @Get('status')
  async checkStatus(@Query('paymentId') paymentId: string) {
    return await this.paymentService.getPaymentStatus(paymentId);
  }
}
