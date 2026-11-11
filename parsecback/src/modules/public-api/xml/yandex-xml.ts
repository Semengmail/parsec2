// src/modules/public-api/xml/yandex-xml.ts
import type { SerpResultItem } from '../entities/googlelive-task.entity';
import {
  getNum,
  getStr,
  isRecord,
  escapeXml,
  formatYxmlDate,
  formatFoundHuman,
  genReqId,
  clampInt,
  extractDomainSafe,
  simpleHexHash,
  renderSitelinks,
} from './xmlHelpers';

export type ResponseContext = {
  query: string;
  /** Номер страницы в нашей модели (1..N). Для XML яндекс — конвертируем в 0-based. */
  page?: number;
  /** Сколько групп (доков) на странице. */
  groupsOnPage?: number;
  /** Сколько всего найдено (если знаем). */
  totalFound?: number;
  /** Регион / режимы — если захочешь позже расширить <request>. */
  lr?: number;
  device?: 'desktop' | 'mobile';
  totalPages?: number | null;
  lastPage?: boolean | null;
};

export type PageExtras = {
  /** Позиция 0 / фича-ответ */
  zeroposition?: {
    title?: string;
    url?: string;
    text?: string;
  } | null;
  /** Похожие запросы */
  relatedQuestions?: string[] | null;
  /** Карточка знаний / организация */
  knowledgeGraph?:
    | {
        place_id?: string;
        name?: string;
        rating?: number;
        countReviews?: number;
        address?: string;
        phone?: string;
      }
    | Record<string, unknown>
    | null;
};

/** универсальный билдер «богатого» XML */
export function buildYandexXmlOkRich(
  items: SerpResultItem[],
  pageExtras: PageExtras | null,
  ctx: ResponseContext,
): string {
  const found = Math.max(0, ctx.totalFound ?? items.length);
  const page0 = Math.max(0, ctx.page ?? 1); // 1-based → 0-based
  const groupsOnPage = clampInt(ctx.groupsOnPage ?? 100, 1, 1000);
  const docsInGroup = 1 as const;

  const date = formatYxmlDate(new Date());
  const reqid = genReqId();

  // Зеропозицию берём из pageExtras.zeroposition или из первого doc, у которого есть featuredSnippet
  const zp = pageExtras?.zeroposition ?? detectZeroPositionFromDocs(items);

  // <addresults>
  const addresults = renderAddresults(zp, pageExtras);

  // <grouping> — по одному doc в группе
  const groupsXml = items.map((it, idx) => renderGroupDoc(it, idx)).join('');

  // first/last — диапазон выдачи на текущей странице (для совместимости)
  const first = items.length > 0 ? 1 : 0;
  const last = Math.min(groupsOnPage, items.length);

  return `<?xml version="1.0" encoding="utf-8"?>
<yandexsearch version="1.0">
  <request>
    <query>${escapeXml(ctx.query)}</query>
    <page>${page0}</page>
    <sortby order="descending" priority="no">rlv</sortby>
    <maxpassages>5</maxpassages>
    <groupings>
      <groupby attr="d" mode="deep" groups-on-page="${groupsOnPage}" docs-in-group="${docsInGroup}" curcateg="-1"/>
    </groupings>
  </request>
  <response date="${date}">
    <reqid>${reqid}</reqid>
    <found priority="phrase">${found}</found>
    <found priority="strict">${found}</found>
    <found priority="all">${found}</found>
    <found-human>Нашлось ${formatFoundHuman(found)} ответов</found-human>
    <is-local>yes</is-local>
        ${
          ctx.totalPages != null
            ? '' //`<total-pages>${ctx.totalPages}</total-pages>`
            : ''
        }
    ${
      typeof ctx.lastPage === 'boolean'
        ? `<last-page>${ctx.lastPage ? 'true' : 'false'}</last-page>`
        : ''
    }
    ${addresults}
    <results>
      <grouping attr="d" mode="deep" groups-on-page="${groupsOnPage}" docs-in-group="${docsInGroup}" curcateg="-1">
        <page first="${first}" last="${last}">${page0}</page>
        ${groupsXml}
      </grouping>
    </results>
  </response>
</yandexsearch>`;
}

export function buildYandexXmlPending(
  ctx: Pick<ResponseContext, 'query' | 'page'> & { taskId?: number },
): string {
  const date = formatYxmlDate(new Date());
  const page0 = Math.max(0, (ctx.page ?? 1) - 1);
  const idLine =
    ctx.taskId != null
      ? `\n    <taskId>${ctx.taskId}</taskId>\n    <req_id>${ctx.taskId}</req_id>`
      : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<yandexsearch version="1.0">
  <request>
    <query>${escapeXml(ctx.query)}</query>
    <page>${page0}</page>
    <sortby order="descending" priority="no">rlv</sortby>
    <maxpassages>5</maxpassages>
    <groupings>
      <groupby attr="d" mode="deep" groups-on-page="100" docs-in-group="1" curcateg="-1"/>
    </groupings>
  </request>
  <response date="${date}">
    <status>pending</status>${idLine}
  </response>
</yandexsearch>`;
}

export function buildYandexXmlError(
  code: number,
  message: string,
  ctx?: Partial<Pick<ResponseContext, 'query' | 'page'>>,
): string {
  const date = formatYxmlDate(new Date());
  const reqPart =
    ctx?.query != null
      ? `
  <request>
    <query>${escapeXml(ctx.query)}</query>
    <page>${Math.max(0, (ctx.page ?? 1) - 1)}</page>
    <sortby order="descending" priority="no">rlv</sortby>
    <maxpassages>5</maxpassages>
    <groupings>
      <groupby attr="d" mode="deep" groups-on-page="100" docs-in-group="1" curcateg="-1"/>
    </groupings>
  </request>`
      : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<yandexsearch version="1.0">
  ${reqPart}
  <response date="${date}">
    <error code="${code}">${escapeXml(message)}</error>
  </response>
</yandexsearch>`;
}

/* ───────────── helpers ───────────── */

function renderAddresults(
  zp: PageExtras['zeroposition'] | null | undefined,
  pageExtras: PageExtras | null,
): string {
  const blocks: string[] = [];

  // <zeroposition>
  if (zp && (zp.title || zp.url || zp.text)) {
    blocks.push(
      [
        '<zeroposition>',
        zp.title ? `<title>${escapeXml(zp.title)}</title>` : '<title/>',
        zp.url ? `<url>${escapeXml(zp.url)}</url>` : '<url/>',
        zp.text
          ? `<extendedpassage>${escapeXml(zp.text)}</extendedpassage>`
          : '',
        '</zeroposition>',
      ].join(''),
    );
  }

  // <relatedQuestions>
  const rq = pageExtras?.relatedQuestions ?? null;
  if (Array.isArray(rq) && rq.length) {
    const questions = rq
      .filter((q) => typeof q === 'string' && q.trim().length)
      .map((q) => `<question><title>${escapeXml(q)}</title></question>`)
      .join('');
    blocks.push(`<relatedQuestions>${questions}</relatedQuestions>`);
  }

  // <knowledge_graph>
  const kg = pageExtras?.knowledgeGraph ?? null;
  if (isRecord(kg)) {
    const place_id = getStr(kg, 'place_id');
    const name = getStr(kg, 'name');
    const rating = getNum(kg, 'rating');
    const countReviews = getNum(kg, 'countReviews');
    const address = getStr(kg, 'address');
    const phone = getStr(kg, 'phone');

    const parts: string[] = ['<knowledge_graph>'];
    if (place_id) parts.push(`<place_id>${escapeXml(place_id)}</place_id>`);
    if (name) parts.push(`<name>${escapeXml(name)}</name>`);
    if (rating != null)
      parts.push(`<rating>${escapeXml(String(rating))}</rating>`);
    if (countReviews != null) {
      parts.push(
        `<countReviews>${escapeXml(String(countReviews))}</countReviews>`,
      );
    }
    if (address) parts.push(`<address>${escapeXml(address)}</address>`);
    if (phone) parts.push(`<phone>${escapeXml(phone)}</phone>`);
    parts.push('</knowledge_graph>');
    blocks.push(parts.join(''));
  }

  return blocks.length ? `<addresults>${blocks.join('')}</addresults>` : '';
}

function detectZeroPositionFromDocs(
  items: SerpResultItem[],
): PageExtras['zeroposition'] | null {
  for (const it of items) {
    const fs = it.extras?.featuredSnippet;
    if (fs && (fs.title || fs.url || fs.text)) {
      return {
        title: fs.title,
        url: fs.url ?? it.url,
        text: fs.text ?? undefined,
      };
    }
  }
  return null;
}

function renderGroupDoc(it: SerpResultItem, idx: number): string {
  const title = it.title ? `<title>${escapeXml(it.title)}</title>` : '<title/>';
  const domain = it.site ?? extractDomainSafe(it.url);
  const docId = 'Z' + simpleHexHash(it.url);
  const breadcrumbs = domain
    ? `<breadcrumbs>${escapeXml(domain)}</breadcrumbs>`
    : '<breadcrumbs/>';
  const siteName = '<site_name/>';

  const extra = it.extras ?? {};
  const pubDate = extra.pubDate
    ? `<pubDate>${escapeXml(extra.pubDate)}</pubDate>`
    : '';
  const extendedPassage = extra.featuredSnippet?.text
    ? `<extendedpassage>${escapeXml(extra.featuredSnippet.text)}</extendedpassage>`
    : '';

  const passages =
    Array.isArray(extra.passages) && extra.passages.length
      ? `<passages>${extra.passages
          .filter((p) => typeof p === 'string' && p.trim().length)
          .map((p) => `<passage>${escapeXml(p)}</passage>`)
          .join('')}</passages>`
      : '';

  const sitelinksBlock = renderSitelinks('sitelinks', extra.sitelinks);
  const onelineSitelinksBlock = renderSitelinks(
    'oneline_sitelinks',
    extra.onelineSitelinks,
  );

  // contenttype — по умолчанию «organic» (если понадобится, можно пробрасывать из rs)
  const contenttype = '<contenttype>organic</contenttype>';

  return `
<group id="${idx + 1}">
  <doccount>1</doccount>
  <doc id="${docId}">
    <url>${escapeXml(it.url)}</url>
    ${siteName}
    ${title}
    ${contenttype}
    ${breadcrumbs}
    ${pubDate}
    ${extendedPassage}
    ${passages}
    ${sitelinksBlock}
    ${onelineSitelinksBlock}
  </doc>
</group>`;
}
