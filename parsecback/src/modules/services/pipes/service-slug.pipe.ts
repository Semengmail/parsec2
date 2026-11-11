// src/modules/services/pipes/service-slug.pipe.ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { getServiceBySlug, type ServiceDescriptor } from '../services.registry';

@Injectable()
export class ServiceSlugPipe implements PipeTransform<
  string,
  ServiceDescriptor
> {
  transform(value: string): ServiceDescriptor {
    const d = getServiceBySlug(value);
    if (!d) throw new BadRequestException('unknown_service');
    return d;
  }
}
