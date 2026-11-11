// src/modules/test-bench/test-bench-engine-config.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestBenchEngineConfig } from './entities/test-bench-engine-config.entity';
import { UpdateEngineConfigDto } from './dto/update-engine-config.dto';

type Engine = 'yandex' | 'google';

@Injectable()
export class TestBenchEngineConfigService {
  constructor(
    @InjectRepository(TestBenchEngineConfig)
    private readonly repo: Repository<TestBenchEngineConfig>,
  ) {}

  async getAllConfigs(): Promise<TestBenchEngineConfig[]> {
    return this.repo.find();
  }

  async getConfig(engine: Engine): Promise<TestBenchEngineConfig> {
    const cfg = await this.repo.findOne({ where: { engine } });
    if (!cfg) throw new NotFoundException('Engine config not found');
    return cfg;
  }

  async getBlock(
    engine: Engine,
  ): Promise<{ blocked: boolean; reason: string | null }> {
    type Row = { blocked: boolean; reason: string | null };

    const rows = await this.repo.query<Row[]>(
      `SELECT blocked, reason FROM test_bench_engine_block WHERE engine = $1`,
      [engine],
    );

    if (!rows?.length) return { blocked: false, reason: null };
    return {
      blocked: rows[0].blocked === true,
      reason: rows[0].reason ?? null,
    };
  }

  async setBlock(
    engine: Engine,
    blocked: boolean,
    reason: string | null = null,
  ): Promise<void> {
    await this.repo.query(
      `
        INSERT INTO test_bench_engine_block (engine, blocked, reason)
        VALUES ($1, $2, $3)
        ON CONFLICT (engine)
        DO UPDATE SET blocked=$2, reason=$3
      `,
      [engine, blocked, reason],
    );
  }

  /** ---------- ВАЖНОЕ: собрать полный объект ---------- */
  async getFullConfig(engine: Engine) {
    const cfg = await this.getConfig(engine);
    const block = await this.getBlock(engine);
    return { ...cfg, blocked: block.blocked, blockReason: block.reason };
  }

  async getFullList() {
    const cfgs = await this.getAllConfigs();

    return Promise.all(
      cfgs.map(async (cfg) => {
        const block = await this.getBlock(cfg.engine);
        return { ...cfg, blocked: block.blocked, blockReason: block.reason };
      }),
    );
  }

  async update(engine: Engine, dto: UpdateEngineConfigDto) {
    const cfg = await this.getConfig(engine);
    Object.assign(cfg, dto);
    return this.repo.save(cfg);
  }
}
