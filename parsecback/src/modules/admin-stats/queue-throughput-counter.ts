export type QueueThroughputEngine = 'yandexlive' | 'googlelive';
export type QueueThroughputDevice = 'desktop' | 'mobile';

export type QueueThroughputCounterSnapshot = {
  total: number;
  byEngine: Record<
    QueueThroughputEngine,
    {
      total: number;
      desktop: number;
      mobile: number;
    }
  >;
};

const counters: Record<
  QueueThroughputEngine,
  Record<QueueThroughputDevice, number>
> = {
  yandexlive: { desktop: 0, mobile: 0 },
  googlelive: { desktop: 0, mobile: 0 },
};

export function addQueueThroughputPages(
  engine: QueueThroughputEngine,
  device: QueueThroughputDevice,
  pages: number,
): void {
  const safePages = Math.max(0, Math.trunc(pages));
  if (safePages <= 0) return;

  counters[engine][device] += safePages;
}

export function drainQueueThroughputPages(): QueueThroughputCounterSnapshot {
  const yandexDesktop = counters.yandexlive.desktop;
  const yandexMobile = counters.yandexlive.mobile;
  const googleDesktop = counters.googlelive.desktop;
  const googleMobile = counters.googlelive.mobile;

  counters.yandexlive.desktop = 0;
  counters.yandexlive.mobile = 0;
  counters.googlelive.desktop = 0;
  counters.googlelive.mobile = 0;

  const yandex = {
    desktop: yandexDesktop,
    mobile: yandexMobile,
    total: yandexDesktop + yandexMobile,
  };
  const google = {
    desktop: googleDesktop,
    mobile: googleMobile,
    total: googleDesktop + googleMobile,
  };

  return {
    total: yandex.total + google.total,
    byEngine: {
      yandexlive: yandex,
      googlelive: google,
    },
  };
}
