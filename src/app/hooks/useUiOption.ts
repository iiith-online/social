import { useCallback, useMemo, useState } from 'react';
import { useElementSizeObserver } from './useElementSizeObserver';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom, UiOption } from '../state/settings';

export type ResolvedUiOption = Exclude<UiOption, 'auto'>;

export const resolveUiOption = (
  uiOption: UiOption,
  width: number,
  height: number
): ResolvedUiOption => {
  if (uiOption !== 'auto') return uiOption;
  return width < height ? 'matrix-android' : 'matrix';
};

export const useResolvedUiOption = (): ResolvedUiOption => {
  const [uiOption] = useSetting(settingsAtom, 'uiOption');
  const [viewport, setViewport] = useState(() => ({
    width: document.body.clientWidth || window.innerWidth,
    height: document.body.clientHeight || window.innerHeight,
  }));

  useElementSizeObserver(
    useCallback(() => document.body, []),
    useCallback((width, height) => setViewport({ width, height }), [])
  );

  return useMemo(
    () => resolveUiOption(uiOption, viewport.width, viewport.height),
    [uiOption, viewport]
  );
};
