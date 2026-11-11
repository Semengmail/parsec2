import { Controller, Get, Header, HttpCode } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isStubMode } from './common/stub-mode';

const FAVICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#111827"/>
  <path d="M18 18h18c9.941 0 18 8.059 18 18s-8.059 18-18 18H18z" fill="#22c55e"/>
  <path d="M28 28h8c2.209 0 4 1.791 4 4s-1.791 4-4 4h-8z" fill="#111827"/>
</svg>
`.trim();

@Controller()
export class SystemController {
  constructor(private readonly config: ConfigService) {}

  @Get('health')
  @Header('Cache-Control', 'no-store')
  health(): { stubMode: boolean } {
    return { stubMode: isStubMode(this.config) };
  }

  @Get('favicon.ico')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400')
  getFavicon(): string {
    return FAVICON_SVG;
  }

  @Get('.well-known/appspecific/com.chrome.devtools.json')
  @HttpCode(204)
  getChromeDevtoolsWellKnown(): void {}
}
