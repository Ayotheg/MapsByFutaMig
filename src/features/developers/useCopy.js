import { useCallback } from 'react';

/** Copies text to the clipboard; resolves true if it worked. */
export function useCopy() {
  return useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);
}
