import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ImportRequestDto } from './dto/import-request.dto';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('import-request')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    ip: { limit: 3, ttl: 60_000 },
    account: { limit: 10, ttl: 3_600_000, getTracker: () => 'import-mailbox' },
  })
  sendImportRequest(@Body() dto: ImportRequestDto) {
    return this.mailService.sendImportRequest(dto.contact);
  }
}
