import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@/common/guards/jwt-cookie.guard';
import { UserId } from '@/common/decorators/user-id.decorator';
import { ServiceSlugPipe } from './pipes/service-slug.pipe';
import type { ServiceDescriptor } from './services.registry';
import {
  ServicesService,
  type SeriesPoint,
  type ServiceSummary,
  type SeriesGroup,
} from './services.service';
import { GenericSettingsDto } from './dto/settings.dto';
import { UrlPreviewService } from './url-preview.service';

@Controller('services/:slug')
@UseGuards(JwtCookieGuard)
export class ServicesController {
  constructor(
    private readonly svc: ServicesService,
    private readonly urlPreview: UrlPreviewService,
  ) {}

  @Get('summary')
  summary(
    @UserId() userId: number,
    @Param('slug', ServiceSlugPipe) desc: ServiceDescriptor,
  ): Promise<ServiceSummary> {
    return this.svc.summary(userId, desc);
  }

  @Get('series')
  series(
    @UserId() userId: number,
    @Param('slug', ServiceSlugPipe) desc: ServiceDescriptor,
    @Query('group') qgroup?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<SeriesPoint[]> {
    const group: SeriesGroup =
      qgroup === 'hour' || qgroup === 'month' ? qgroup : 'day';

    const now = new Date();
    const defFrom =
      group === 'hour'
        ? new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          ).toISOString()
        : group === 'day'
          ? new Date(now.getTime() - 30 * 86_400_000).toISOString()
          : new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
    const defTo = now.toISOString();

    // ВАЖНО: порядок аргументов — group, затем from, to
    return this.svc.series(userId, desc, group, from || defFrom, to || defTo);
  }

  @Get('settings')
  async getSettings(
    @UserId() userId: number,
    @Param('slug', ServiceSlugPipe) desc: ServiceDescriptor,
  ): Promise<{
    descriptor: Pick<
      ServiceDescriptor,
      'title' | 'help' | 'supports' | 'slug' | 'code' | 'method'
    >;
    settings: GenericSettingsDto;
    publicUrlExample: string;
    publicUrlResultsExample?: string;
  }> {
    const settings = await this.svc.getSettings(userId, desc);
    const publicUrlExample = await this.urlPreview.buildPublicUrlExample(
      userId,
      desc,
      settings,
    );

    if (
      (desc.slug === 'frequency' && !settings?.lr) ||
      (desc.slug === 'wordstat' && !settings?.lr)
    ) {
      settings.lr = 225;
    }

    const publicUrlResultsExample =
      await this.urlPreview.buildPublicUrlResultsExample(userId, desc);
    return {
      descriptor: {
        title: desc.title,
        help: desc.help,
        supports: desc.supports,
        slug: desc.slug,
        code: desc.code,
        method: desc.method,
      },
      settings,
      publicUrlExample,
      publicUrlResultsExample,
    };
  }

  @Put('settings')
  async saveSettings(
    @UserId() userId: number,
    @Param('slug', ServiceSlugPipe) desc: ServiceDescriptor,
    @Body() dto: GenericSettingsDto,
  ): Promise<{ ok: true }> {
    await this.svc.saveSettings(userId, desc, dto);
    return { ok: true };
  }
}
