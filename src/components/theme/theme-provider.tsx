"use client";

import * as React from "react";
import { DEFAULT_THEME, isTheme, type Theme } from "@/lib/theme";

export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "testtick-theme";

/**
 * Runs before first paint so a stored preference never flashes. Dark is opt-in:
 * with nothing stored we stay light even when the OS prefers dark, and only the
 * explicit "system" choice follows `prefers-color-scheme`.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * `localStorage` is an external store, so the preference is read through
 * `useSyncExternalStore` instead of being copied into state inside an effect.
 * Writes from this tab notify subscribers directly; other tabs arrive as
 * `storage` events.
 */
const storeListeners = new Set<() => void>();

function subscribeStored(onChange: () => void) {
  storeListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    storeListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStored(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeStored(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing / storage disabled — the in-memory choice still applies.
  }
  for (const listener of storeListeners) listener();
}

function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readSystemDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  serverTheme,
  persist,
}: {
  children: React.ReactNode;
  /** Preference stored on the user record, used when this device has none yet. */
  serverTheme?: Theme;
  /** Server action mirroring the choice back onto the user record. */
  persist?: (theme: Theme) => void | Promise<unknown>;
}) {
  const fallback = serverTheme ?? DEFAULT_THEME;

  // On the server, and while hydrating, fall back to the stored user preference.
  const stored = React.useSyncExternalStore(
    subscribeStored,
    readStored,
    () => null,
  );
  const systemDark = React.useSyncExternalStore(
    subscribeSystem,
    readSystemDark,
    () => false,
  );

  const theme = stored ?? fallback;
  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = React.useCallback(
    (next: Theme) => {
      writeStored(next);
      // Mirroring onto the user record is best-effort: this device already has
      // the choice, so a failed write must not surface as an unhandled rejection.
      void Promise.resolve(persist?.(next)).catch(() => {});
    },
    [persist],
  );

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
