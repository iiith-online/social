import { ReactNode, useCallback } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import {
  getDirectPath,
  getHomePath,
  getInboxPath,
  getRecentPath,
  getSpacePath,
} from '../pages/pathUtils';
import {
  DIRECT_PATH,
  EXPLORE_PATH,
  HOME_PATH,
  INBOX_PATH,
  RECENT_PATH,
  SPACE_PATH,
} from '../pages/paths';

type BackRouteHandlerProps = {
  children: (onBack: () => void) => ReactNode;
};

export const getBackPath = (pathname: string): string | undefined => {
  if (matchPath({ path: HOME_PATH, caseSensitive: true, end: true }, pathname)) return undefined;
  if (matchPath({ path: RECENT_PATH, caseSensitive: true, end: true }, pathname)) return undefined;
  if (matchPath({ path: DIRECT_PATH, caseSensitive: true, end: true }, pathname)) return undefined;
  if (matchPath({ path: INBOX_PATH, caseSensitive: true, end: true }, pathname)) return undefined;

  if (matchPath({ path: HOME_PATH, caseSensitive: true, end: false }, pathname)) {
    return getHomePath();
  }
  if (matchPath({ path: RECENT_PATH, caseSensitive: true, end: false }, pathname)) {
    return getRecentPath();
  }
  if (matchPath({ path: DIRECT_PATH, caseSensitive: true, end: false }, pathname)) {
    return getDirectPath();
  }
  if (matchPath({ path: EXPLORE_PATH, caseSensitive: true, end: false }, pathname)) {
    return getRecentPath();
  }

  const spaceMatch = matchPath({ path: SPACE_PATH, caseSensitive: true, end: false }, pathname);
  const encodedSpaceIdOrAlias = spaceMatch?.params.spaceIdOrAlias;
  if (encodedSpaceIdOrAlias) {
    return getSpacePath(decodeURIComponent(encodedSpaceIdOrAlias));
  }

  if (matchPath({ path: INBOX_PATH, caseSensitive: true, end: false }, pathname)) {
    return getInboxPath();
  }

  return undefined;
};

export function BackRouteHandler({ children }: BackRouteHandlerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = useCallback(() => {
    const backPath = getBackPath(location.pathname);
    if (backPath) navigate(backPath);
  }, [navigate, location]);

  return children(goBack);
}
