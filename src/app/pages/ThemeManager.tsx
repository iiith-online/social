import React, { ReactNode, useLayoutEffect } from 'react';
import { color, configClass, varsClass } from 'folds';
import {
  DarkTheme,
  LightTheme,
  ThemeContextProvider,
  ThemeKind,
  useActiveTheme,
  useSystemThemeKind,
} from '../hooks/useTheme';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';
import { useResolvedUiOption } from '../hooks/useUiOption';

export function UnAuthRouteThemeManager() {
  const systemThemeKind = useSystemThemeKind();

  useLayoutEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);
    delete document.body.dataset.uiOption;
    if (systemThemeKind === ThemeKind.Dark) {
      document.body.classList.add(...DarkTheme.classNames);
    }
    if (systemThemeKind === ThemeKind.Light) {
      document.body.classList.add(...LightTheme.classNames);
    }
    document.body.style.backgroundColor = color.Background.Container;
  }, [systemThemeKind]);

  return null;
}

export function AuthRouteThemeManager({ children }: { children: ReactNode }) {
  const activeTheme = useActiveTheme();
  const [monochromeMode] = useSetting(settingsAtom, 'monochromeMode');
  const uiOption = useResolvedUiOption();

  useLayoutEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);

    document.body.classList.add(...activeTheme.classNames);
    document.body.dataset.uiOption = uiOption;

    if (monochromeMode) {
      document.body.style.filter = 'grayscale(1)';
    } else {
      document.body.style.filter = '';
    }
    document.body.style.backgroundColor = color.Background.Container;
  }, [activeTheme, monochromeMode, uiOption]);

  return <ThemeContextProvider value={activeTheme}>{children}</ThemeContextProvider>;
}
