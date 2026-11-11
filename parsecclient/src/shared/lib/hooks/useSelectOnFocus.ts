'use client';

import { useRef } from 'react';

export function useSelectOnFocus() {
  const ref = useRef<HTMLInputElement>(null);
  const handleFocus = () => {
    if (ref.current) {
      ref.current.select();
    }
  };

  return { ref, handleFocus };
}
