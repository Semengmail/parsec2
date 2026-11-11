// src/modules/public-api/rankscan.client.ts
import {
  isRecord,
  mapSitelinksOrNull,
  toBooleanOrNull,
  toFiniteNumber,
  toSafeString,
  toStringArrayOrNull,
  toStringOrNull,
  toTrimmedLower,
} from '@/shared/helpers/guards';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RankScanSearchEngine = 'google' | 'yandex' | 'yandexlive';

export type RSSitelink = { url: string; title?: string; snippet?: string };

export type RankScanCreateTaskExtras = {
  groupby?: number;
  domain?: string;
  domainId?: number;
  tbm?: '' | 'images' | 'video';
  tbs?: '' | 'qdr:h' | 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y';
  hl?: string;
  gl?: string;
  ads?: boolean;
  related?: boolean;
  video?: boolean;
  filter?: boolean;
  punycode?: boolean;
  hlword?: boolean;
  delayed?: boolean;
  cityName?: string;
};

export type RankScanCreateTaskBase = {
  query: string;
  device: 'desktop' | 'mobile';
  lr: number;
  searchEngine: RankScanSearchEngine;
  page?: number;
  latitude?: number;
  longitude?: number;
  uule?: string;
};

export type RankScanCreateTaskPayload = RankScanCreateTaskBase &
  RankScanCreateTaskExtras;

export type RankScanCreateTaskResponse = { id: number };

export type RSCreateResp = {
  id: number;
  query: string;
  device: 'desktop' | 'mobile';
  lr: number;
  searchEngine: 'google' | 'yandex' | 'yandexlive';
  status: string;
  currentPage: number;
  page: number;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RSResult = {
  position: number;
  url: string;
  site?: string | null;
  title?: string | null;
  page?: number | null;
  pubDate?: string | null;
  passages?: string[] | null;
  extendedPassage?: string | null;
  sitelinks?: RSSitelink[] | null;
  onelineSitelinks?: RSSitelink[] | null;
  isFeaturedSnippet?: boolean | null;
  server?: string | null;
};

// строго типизируем элементы pageMeta, но оставляем поля опциональными
export type RSPageMetaItem = {
  page?: number;
  relatedQuestions?: string[] | null;
  knowledgeGraph?: Record<string, unknown> | null;
};

export type RSGetResp =
  | { status: 'pending' }
  | { status: 'not_found' }
  | {
      status: 'completed';
      results: RSResult[];
      relatedQuestions?: string[] | null;
      knowledgeGraph?: Record<string, unknown> | null;
      pageMeta?: RSPageMetaItem[] | null;
      totalPages?: number;
      lastPage?: boolean;
      processedPages?: number;
      pagesByServer?: Record<string, number>;
    };

@Injectable()
export class RankScanClient {
  private readonly base: string;
  private readonly createTimeoutMs: number;
  private readonly getTimeoutMs: number;

  constructor(cfg: ConfigService) {
    this.base =
      cfg.get<string>('RANKSCAN_BASE_URL') ?? 'http://62.238.34.253:3003';
    this.createTimeoutMs = this.readTimeout(
      cfg.get<string>('RANKSCAN_CREATE_TIMEOUT_MS'),
      10_000,
    );
    this.getTimeoutMs = this.readTimeout(
      cfg.get<string>('RANKSCAN_GET_TIMEOUT_MS'),
      8_000,
    );
  }

  private readTimeout(raw: string | undefined, fallback: number): number {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  }

  private async fetchJsonWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<{ res: Response; data: unknown }> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal });
      let data: unknown = null;
      if (res.headers.get('content-type')?.includes('application/json')) {
        data = (await res.json()) as unknown;
      } else {
        const text = await res.text();
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          data = text;
        }
      }
      return { res, data };
    } catch (err) {
      const name = (err as { name?: unknown })?.name;
      if (name === 'AbortError') {
        throw new Error(`rank-scan timeout after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async createTask(input: RankScanCreateTaskPayload): Promise<RSCreateResp> {
    try {
      const url = `${this.base}/api/tasks`;
      const { res, data } = await this.fetchJsonWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
        this.createTimeoutMs,
      );
      if (!res.ok) {
        throw new Error(`rank-scan create ${res.status} ${res.statusText}`);
      }
      const id = (data as { id?: unknown }).id;
      if (typeof id !== 'number') {
        throw new Error('rank-scan bad create response');
      }
      return data as RSCreateResp;
    } catch (err) {
      const message = (err as Error).message.toLowerCase();
      throw new Error(message);
    }
  }

  async getTask(externalId: number): Promise<RSGetResp> {
    const url = `${this.base}/api/tasks/${externalId}`;
    const { res, data } = await this.fetchJsonWithTimeout(
      url,
      { method: 'GET' },
      this.getTimeoutMs,
    );
    if (!res.ok)
      throw new Error(`rank-scan get ${res.status} ${res.statusText}`);

    const status = toTrimmedLower(isRecord(data) ? data.status : undefined);
    if (status === 'pending') return { status: 'pending' };
    if (status === 'not_found') return { status: 'not_found' };

    const resultsU = isRecord(data) ? data.results : undefined;
    const resultsArr = Array.isArray(resultsU) ? resultsU : null;

    if (status === 'completed' && resultsArr !== null) {
      const arr = resultsArr ?? [];
      const safe: RSResult[] = [];

      for (const r of arr) {
        if (!isRecord(r)) continue;
        const pos = toFiniteNumber(r.position);
        const urlS = toSafeString(r.url);
        if (pos === null || urlS === null || urlS === '') continue;

        const siteU = r.site;
        const titleU = r.title;
        const page = toFiniteNumber(r.page);
        const pubDate = toStringOrNull(r.pubDate);
        const passages = toStringArrayOrNull(r.passages);
        const extendedPassage = toStringOrNull(r.extendedPassage);
        const sitelinks = mapSitelinksOrNull(r.sitelinks);
        const onelineSitelinks = mapSitelinksOrNull(r.onelineSitelinks);
        const isFeaturedSnippet = toBooleanOrNull(r.isFeaturedSnippet);
        const server = toStringOrNull(r.server);

        safe.push({
          position: pos,
          url: urlS,
          site: typeof siteU === 'string' ? siteU : null,
          title: typeof titleU === 'string' ? titleU : null,
          page: page ?? null,
          pubDate,
          passages,
          extendedPassage,
          sitelinks,
          onelineSitelinks,
          isFeaturedSnippet,
          server,
        });
      }

      // --- топ-левел extras ---
      const tlRQ = isRecord(data) ? data.relatedQuestions : undefined;
      const relatedQuestions =
        Array.isArray(tlRQ) && tlRQ.every((x) => typeof x === 'string')
          ? tlRQ
          : undefined;

      const tlKG = isRecord(data) ? data.knowledgeGraph : undefined;
      const knowledgeGraph = isRecord(tlKG) ? tlKG : undefined;

      // --- pageMeta (санитизируем только полезные поля) ---
      const pmU = isRecord(data) ? data.pageMeta : undefined;
      let pageMeta: RSPageMetaItem[] | undefined;
      if (Array.isArray(pmU)) {
        pageMeta = pmU
          .map((x): RSPageMetaItem | null => {
            if (!isRecord(x)) return null;
            const pageNum = toFiniteNumber(x.page ?? null) ?? undefined;

            const rqU = x.relatedQuestions;
            const rq =
              Array.isArray(rqU) && rqU.every((s) => typeof s === 'string')
                ? rqU
                : undefined;

            const kgU = x.knowledgeGraph;
            const kg = isRecord(kgU) ? kgU : undefined;

            const item: RSPageMetaItem = {};
            if (pageNum !== undefined) item.page = pageNum;
            if (rq) item.relatedQuestions = rq;
            if (kg) item.knowledgeGraph = kg;
            return Object.keys(item).length ? item : null;
          })
          .filter((v): v is RSPageMetaItem => v !== null);
        if (pageMeta.length === 0) pageMeta = undefined;
      }

      const totalPages = toFiniteNumber((data as any).totalPages);
      const lastPage =
        isRecord(data) && typeof data.lastPage === 'boolean'
          ? data.lastPage
          : undefined;
      const processedPages = toFiniteNumber((data as any).processedPages);
      const rawPagesByServer = isRecord(data) ? data.pagesByServer : undefined;
      const pagesByServer: Record<string, number> | undefined = isRecord(
        rawPagesByServer,
      )
        ? Object.fromEntries(
            Object.entries(rawPagesByServer).flatMap(([server, pages]) => {
              const count = toFiniteNumber(pages);
              const name = server.trim();
              return count != null &&
                Number.isInteger(count) &&
                count > 0 &&
                name
                ? [[name, count]]
                : [];
            }),
          )
        : undefined;

      return {
        status: 'completed',
        results: safe,
        ...(relatedQuestions ? { relatedQuestions } : {}),
        ...(knowledgeGraph ? { knowledgeGraph } : {}),
        ...(pageMeta ? { pageMeta } : {}),
        ...(totalPages != null ? { totalPages } : {}),
        ...(lastPage != null ? { lastPage } : {}),
        ...(processedPages != null ? { processedPages } : {}),
        ...(pagesByServer ? { pagesByServer } : {}),
      };
    }

    // fallback
    let sample = '[unserializable]';
    try {
      const s = JSON.stringify(data);
      sample = s.length > 400 ? `${s.slice(0, 400)}…` : s;
    } catch {
      sample = '[unserializable]';
    }
    throw new Error(`rank-scan bad get response: ${sample}`);
  }
}
