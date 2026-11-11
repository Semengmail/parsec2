import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface BlockRow {
  blocked: boolean;
}

@Injectable()
export class EngineBlockService {
  constructor(private readonly ds: DataSource) {}

  async isEngineBlocked(engine: 'yandex' | 'google'): Promise<boolean> {
    const rows = (await this.ds.query(
      `SELECT blocked FROM test_bench_engine_block WHERE engine=$1`,
      [engine],
    )) as unknown as BlockRow[];

    return Boolean(rows[0]?.blocked);
  }
}
