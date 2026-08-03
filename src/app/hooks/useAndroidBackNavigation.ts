import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getBackPath } from '../components/BackRouteHandler';

export const useAndroidBackNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location);
  const portalHistoryRef = useRef(false);
  const ignoreNextPopStateRef = useRef(false);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    const portal = document.getElementById('portalContainer');
    if (!portal) return undefined;

    let wasOpen = false;
    const syncPortalHistory = () => {
      const isOpen = portal.children.length > 0;
      if (isOpen && !wasOpen) {
        window.history.pushState(window.history.state, '', window.location.href);
        portalHistoryRef.current = true;
      } else if (!isOpen) {
        portalHistoryRef.current = false;
      }
      wasOpen = isOpen;
    };

    const observer = new MutationObserver(syncPortalHistory);
    observer.observe(portal, { childList: true });
    syncPortalHistory();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false;
        return;
      }

      const portal = document.getElementById('portalContainer');
      if (portal?.children.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (portalHistoryRef.current) {
          ignoreNextPopStateRef.current = true;
          window.history.forward();
        } else {
          const currentPath = `${locationRef.current.pathname}${locationRef.current.search}${locationRef.current.hash}`;
          navigate(currentPath, { replace: true });
        }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }

      const backPath = getBackPath(locationRef.current.pathname);
      if (!backPath) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(backPath, { replace: true });
    };

    window.addEventListener('popstate', handlePopState, true);
    return () => window.removeEventListener('popstate', handlePopState, true);
  }, [navigate]);
};
