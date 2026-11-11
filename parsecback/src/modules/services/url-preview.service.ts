import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@/modules/users/users.service';
import type { ServiceDescriptor } from './services.registry';
import type { ServiceSettingsValue } from './entities/service-settings.entity';

@Injectable()
export class UrlPreviewService {
  constructor(
    private readonly cfg: ConfigService,
    private readonly users: UsersService,
  ) {}

  async buildPublicUrlExample(
    userId: number,
    svc: ServiceDescriptor,
    settings: ServiceSettingsValue,
  ): Promise<string> {
    const base = this.cfg.get<string>('PUBLIC_URL', 'http://localhost:3000');
    const { apiKey } = await this.users.getProfileWithApiKey(userId);

    const url = new URL(svc.publicPath, base);
    url.searchParams.set('user', String(userId));
    url.searchParams.set('key', apiKey);

    if (svc.supports.lr && typeof settings.lr === 'number')
      url.searchParams.set('lr', String(settings.lr));
    if (svc.supports.device && settings.device)
      url.searchParams.set('device', settings.device);
    if (svc.supports.geo) {
      if (typeof settings.latitude === 'number')
        url.searchParams.set('latitude', String(settings.latitude));
      if (typeof settings.longitude === 'number')
        url.searchParams.set('longitude', String(settings.longitude));
    }
    if (svc.supports.query !== false) {
      url.searchParams.set('query', '');
    }
    return url.toString();
  }
  async buildPublicUrlResultsExample(
    userId: number,
    svc: ServiceDescriptor,
  ): Promise<string> {
    const base = this.cfg.get<string>('PUBLIC_URL', 'http://localhost:3000');
    const { apiKey } = await this.users.getProfileWithApiKey(userId);

    const url = new URL(`${svc.publicPath}/status`, base);
    url.searchParams.set('user', String(userId));
    url.searchParams.set('key', apiKey);
    url.searchParams.set('id', '');
    return url.toString();
  }
}
