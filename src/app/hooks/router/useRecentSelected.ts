import { useMatch } from 'react-router-dom';
import { getRecentPath } from '../../pages/pathUtils';

export const useRecentSelected = (): boolean => {
  const recentMatch = useMatch({
    path: getRecentPath(),
    caseSensitive: true,
    end: false,
  });

  return !!recentMatch;
};
