// src/modules/test-bench/test-bench-phrases-admin.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TestBenchPhrase } from './entities/test-bench-phrase.entity';
import {
  CreateTestBenchPhraseDto,
  UpdateTestBenchPhraseDto,
  ListTestBenchPhrasesQueryDto,
} from './dto/upsert-test-bench-phrase.dto';

@Injectable()
export class TestBenchPhrasesAdminService {
  constructor(
    @InjectRepository(TestBenchPhrase)
    private readonly repo: Repository<TestBenchPhrase>,
  ) {}

  async list(params: ListTestBenchPhrasesQueryDto) {
    const qb = this.repo.createQueryBuilder('p');

    if (typeof params.active === 'boolean') {
      qb.andWhere('p.active = :active', { active: params.active });
    }

    if (params.type) {
      qb.andWhere('p.type = :type', { type: params.type });
    }

    if (params.engine) {
      qb.andWhere('(p.searchEngine IS NULL OR p.searchEngine = :engine)', {
        engine: params.engine,
      });
    }

    if (params.search) {
      qb.andWhere('p.phrase ILIKE :q', { q: `%${params.search}%` });
    }

    qb.orderBy('p.id', 'ASC');

    const limit = params.limit && params.limit > 0 ? params.limit : 100;
    const offset = params.offset && params.offset > 0 ? params.offset : 0;

    qb.take(limit).skip(offset);

    const [items, total] = await qb.getManyAndCount();

    return { items, total, offset, limit };
  }

  async getOne(id: number): Promise<TestBenchPhrase> {
    const phrase = await this.repo.findOne({ where: { id } });
    if (!phrase) throw new NotFoundException('Test phrase not found');
    return phrase;
  }

  async create(dto: CreateTestBenchPhraseDto): Promise<TestBenchPhrase> {
    const entity = this.repo.create({
      phrase: dto.phrase,
      active: dto.active ?? true,
      tags: dto.tags ?? null,
      type: dto.type ?? 'speed',
      searchEngine: dto.searchEngine ?? null,
    });

    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: UpdateTestBenchPhraseDto,
  ): Promise<TestBenchPhrase> {
    const entity = await this.getOne(id);

    if (dto.phrase !== undefined) entity.phrase = dto.phrase;
    if (dto.active !== undefined) entity.active = dto.active;
    if (dto.tags !== undefined) entity.tags = dto.tags;
    if (dto.type !== undefined) entity.type = dto.type;
    if (dto.searchEngine !== undefined) entity.searchEngine = dto.searchEngine;

    return this.repo.save(entity);
  }

  async remove(id: number): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) {
      throw new NotFoundException('Test phrase not found');
    }
  }
}
