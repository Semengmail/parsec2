import { Controller, Get, Header, StreamableFile } from '@nestjs/common';
import { GoogleLiveService } from './googlelive.service';

@Controller('public/googlelive')
export class GoogleLiveCatalogController {
  constructor(private readonly svc: GoogleLiveService) {}

  @Get('cities.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="google-cities.xlsx"')
  async download(): Promise<StreamableFile> {
    const buf = await this.svc.exportCitiesXlsx();
    return new StreamableFile(buf);
  }
}
