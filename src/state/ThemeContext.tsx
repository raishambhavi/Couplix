import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getColors, type ThemeMode } from '../theme/colors';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  colors: ReturnType<typeof getColors>;
  /** Persist light/dark (Rose Light palette is always applied). */
  applyTheme: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_MODE_KEY = 'theme:mode';

/** Rose Light accents — sole app palette on top of base light/dark tokens. */
function applyRoseLightPalette(base: ReturnType<typeof getColors>) {
  return {
    ...base,
    border: base.mode === 'dark' ? 'rgba(216, 113, 151, 0.38)' : 'rgba(216, 113, 151, 0.3)',
    cardGlow: base.mode === 'dark' ? 'rgba(216, 113, 151, 0.16)' : 'rgba(216, 113, 151, 0.12)',
    gold: '#D889A7',
    gold2: '#C87495',
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const savedMode = await AsyncStorage.getItem(STORAGE_MODE_KEY);
        if (!mounted) return;
        if (savedMode === 'light' || savedMode === 'dark') setModeState(savedMode);
      } catch {
        // ignore and keep default
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
  }, []);

  const applyTheme = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_MODE_KEY, m).catch(() => {});
  }, []);

  const value = useMemo(() => {
    const colors = applyRoseLightPalette(getColors(mode));
    return {
      mode,
      colors,
      setMode,
      applyTheme,
    };
  }, [mode, setMode, applyTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
