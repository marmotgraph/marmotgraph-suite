// src/hooks/useSessionStorage.ts
import { useCallback, useState } from "react";

export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const readValue = useCallback((): T => {
    try {
      const item = sessionStorage.getItem(key);

      if (item) {
        return JSON.parse(item) as T;
      }
    } catch {
      // Ignore parsing errors and fall back to initialValue.
    }

    return initialValue;
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next =
          typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Ignore storage errors (e.g., quota exceeded).
        }

        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
