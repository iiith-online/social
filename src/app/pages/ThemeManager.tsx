import React, { ReactNode, useLayoutEffect } from 'react';
import { color, configClass, varsClass } from 'folds';
import { DarkTheme, ThemeContextProvider, useActiveTheme } from '../hooks/useTheme';

const UI_OPTION = 'matrix';

export function UnAuthRouteThemeManager() {
  useLayoutEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);
    document.body.classList.add(...DarkTheme.classNames);
    document.body.dataset.uiOption = UI_OPTION;
    document.body.style.backgroundColor = color.Background.Container;
  }, []);

  return null;
}

export function AuthRouteThemeManager({ children }: { children: ReactNode }) {
  const activeTheme = useActiveTheme();

  useLayoutEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);

    document.body.classList.add(...activeTheme.classNames);
    document.body.dataset.uiOption = UI_OPTION;

    document.body.style.backgroundColor = color.Background.Container;
  }, [activeTheme]);

  return <ThemeContextProvider value={activeTheme}>{children}</ThemeContextProvider>;
}
