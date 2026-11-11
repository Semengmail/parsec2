import { TestBenchCaptchaMetric } from '@/features/test-bench/api';

export interface CaptchaGrouped {
  servers: Record<
    string,
    {
      yandex: {
        desktop: TestBenchCaptchaMetric[];
        mobile: TestBenchCaptchaMetric[];
      };
      google: {
        desktop: TestBenchCaptchaMetric[];
        mobile: TestBenchCaptchaMetric[];
      };
    }
  >;
  allDates: string[]; // общая шкала времени
}
