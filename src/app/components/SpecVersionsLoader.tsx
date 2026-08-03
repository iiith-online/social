import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AsyncStatus, useAsyncCallback } from '../hooks/useAsyncCallback';
import { SpecVersions, specVersions } from '../cs-api';

const SPEC_VERSIONS_CACHE_PREFIX = 'matrix-spec-versions-v1:';

const getCacheKey = (baseUrl: string) => `${SPEC_VERSIONS_CACHE_PREFIX}${baseUrl}`;

const readCachedSpecVersions = (baseUrl: string): SpecVersions | undefined => {
  try {
    const value = localStorage.getItem(getCacheKey(baseUrl));
    if (!value) return undefined;

    const cached = JSON.parse(value) as SpecVersions;
    return Array.isArray(cached.versions) ? cached : undefined;
  } catch {
    return undefined;
  }
};

const cacheSpecVersions = (baseUrl: string, versions: SpecVersions) => {
  try {
    localStorage.setItem(getCacheKey(baseUrl), JSON.stringify(versions));
  } catch {
    // Caching is only an optimization; private browsing may disable storage.
  }
};

type SpecVersionsLoaderProps = {
  baseUrl: string;
  fallback?: () => ReactNode;
  error?: (err: unknown, retry: () => void, ignore: () => void) => ReactNode;
  children: (versions: SpecVersions) => ReactNode;
};
export function SpecVersionsLoader({
  baseUrl,
  fallback,
  error,
  children,
}: SpecVersionsLoaderProps) {
  const cachedVersions = useMemo(() => readCachedSpecVersions(baseUrl), [baseUrl]);
  const [state, load] = useAsyncCallback(
    useCallback(async () => {
      const versions = await specVersions(fetch, baseUrl);
      cacheSpecVersions(baseUrl, versions);
      return versions;
    }, [baseUrl])
  );
  const [ignoreError, setIgnoreError] = useState(false);

  const ignoreCallback = useCallback(() => setIgnoreError(true), []);

  useEffect(() => {
    load();
  }, [load]);

  if (
    (state.status === AsyncStatus.Idle || state.status === AsyncStatus.Loading) &&
    !cachedVersions
  ) {
    return fallback?.();
  }

  if (!ignoreError && state.status === AsyncStatus.Error && !cachedVersions) {
    return error?.(state.error, load, ignoreCallback);
  }

  return children(
    state.status === AsyncStatus.Success
      ? state.data
      : cachedVersions ?? { versions: [] }
  );
}
