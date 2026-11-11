/**
 * Returns the exact completed RankScan subtask count and its server split.
 * The fallback keeps Parsec compatible while RankScan instances are deployed.
 */
export function getRankScanThroughput(
  response: {
    processedPages?: number;
    pagesByServer?: Record<string, number>;
  },
  fallbackPages: number,
): { totalPages: number; pagesByServer: Record<string, number> } {
  const totalPages =
    Number.isInteger(response.processedPages) && response.processedPages! > 0
      ? response.processedPages!
      : fallbackPages;
  const entries = Object.entries(response.pagesByServer ?? {}).filter(
    ([, pages]) => Number.isInteger(pages) && pages > 0,
  );
  const splitTotal = entries.reduce((sum, [, pages]) => sum + pages, 0);

  if (splitTotal === totalPages) {
    return { totalPages, pagesByServer: Object.fromEntries(entries) };
  }

  return { totalPages, pagesByServer: { unknown: totalPages } };
}
