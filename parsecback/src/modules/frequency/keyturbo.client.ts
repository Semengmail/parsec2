// src/modules/frequency/keyturbo.client.ts
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

export type KeyTurboCreateTaskPayload = {
  apiKey: string;
  city: number;
  phrases: string[];
  type: 'frequency' | 'wordstat';
  frequencyType?: number[];
  minusWords?: string[];
  yearlyFrequency?: boolean;
};

export type KeyTurboCreateTaskResponse = {
  taskId: number;
  message: string;
  resultsUrl: string;
};

export type KeyTurboResultItem = {
  phrase: string;
  frequencyType: string; // 'W', '[W]', ...
  frequency: number;
};

export type KeyTurboGetResultResponse =
  | {
      taskId: string | number;
      status: 'in_progress';
    }
  | {
      taskId: string | number;
      status: 'completed';
      result: KeyTurboResultItem[];
    };

@Injectable()
export class KeyTurboClient {
  private readonly log = new Logger(KeyTurboClient.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiUrl = process.env.KEYTURBO_FREQUENCY_API_URL || '';
    this.apiKey = process.env.KEYTURBO_TOKEN || '';
  }

  private logAxiosError(err: unknown, ctx: string): void {
    const e = err as AxiosError;
    const msg = e.message;
    const status = e.response?.status;
    const data = e.response?.data;
    this.log.warn(
      `[KeyTurbo:${ctx}] error status=${status} message=${msg} data=${JSON.stringify(
        data,
      )}`,
    );
  }

  async createTask(
    payload: Omit<KeyTurboCreateTaskPayload, 'apiKey'>,
  ): Promise<KeyTurboCreateTaskResponse> {
    const body: KeyTurboCreateTaskPayload = {
      apiKey: this.apiKey,
      ...payload,
    };

    const { data } = await axios.post<KeyTurboCreateTaskResponse>(
      this.apiUrl,
      body,
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    return data;
  }

  async getResult(taskId: number): Promise<KeyTurboGetResultResponse | null> {
    try {
      const { data } = await axios.get<KeyTurboGetResultResponse>(
        `${this.apiUrl}/results`,
        {
          params: {
            apiKey: this.apiKey,
            taskId,
          },
          headers: { 'Content-Type': 'application/json' },
        },
      );

      return data;
    } catch (err) {
      this.logAxiosError(err, `getResult(taskId=${taskId})`);
      return null;
    }
  }
}
