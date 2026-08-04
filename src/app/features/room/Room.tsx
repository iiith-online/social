import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { isKeyHotkey } from 'is-hotkey';
import { PostPage } from '../../pages/client/home/PostPage';
import { RoomFeed } from './RoomFeed';
import { useRoom } from '../../hooks/useRoom';
import { useKeyDown } from '../../hooks/useKeyDown';
import { markAsRead } from '../../utils/notifications';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

export function Room() {
  const { eventId } = useParams();
  const room = useRoom();
  const mx = useMatrixClient();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          markAsRead(mx, room.roomId, hideActivity);
        }
      },
      [mx, room.roomId, hideActivity]
    )
  );

  // Deep links to a specific message show it as a post.
  if (eventId) return <PostPage />;

  return <RoomFeed />;
}
