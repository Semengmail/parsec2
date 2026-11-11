'use client';

import type { StoreApi, UseBoundStore } from 'zustand';

type Selectors<T extends Record<string, unknown>> = {
  [K in keyof T]: () => T[K];
};

type WithSelectors<T extends Record<string, unknown>> = UseBoundStore<
  StoreApi<T>
> & { use: Selectors<T> };

/**
 * Добавляет .use.<key> к zustand-стору:
 * const store = createSelectors(base);
 * store.use.user() // => state.user
 */
export function createSelectors<T extends Record<string, unknown>>(
  store: UseBoundStore<StoreApi<T>>
): WithSelectors<T> {
  type State = T;

  const selectors: Partial<{ [K in keyof State]: () => State[K] }> = {};

  (Object.keys(store.getState()) as Array<keyof State>).forEach((k) => {
    Object.defineProperty(selectors, k, {
      get: () => () => store((s: State) => s[k]),
      enumerable: true,
    });
  });

  const augmented = store as WithSelectors<T>;
  augmented.use = selectors as { [K in keyof State]: () => State[K] };
  return augmented;
}
