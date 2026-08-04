import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Icon, IconButton, Icons, Scroll, Spinner, Text, config, toRem } from 'folds';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { Page, PageHeader } from '../../../components/page';
import { BackRouteHandler } from '../../../components/BackRouteHandler';
import { FeedCard } from '../../../components/post/FeedCard';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { getPostScore, PostVote, togglePostVote } from '../../../utils/postVote';
import {
  collectInlineComments,
  enrichPost,
  FeedPost,
  getPinnedEventIds,
  isPostEvent,
  mapBatched,
  pageRoomHistory,
  waitForCommunityRooms,
} from './useFeedPosts';

const PROFILE_PAGES_PER_ROOM = 3;
const PROFILE_MAX_POSTS = 100;

const loadUserPosts = async (mx: MatrixClient, userId: string): Promise<FeedPost[]> => {
  const ids = await waitForCommunityRooms(mx, 20);
  const rooms = ids
    .map((roomId) => mx.getRoom(roomId))
    .filter((room): room is Room => Boolean(room));

  const matches: FeedPost[] = [];
  const seen = new Set<string>();
  const inlineCounts = new Map<string, number>();
  const counted = new Set<string>();

  const scanRoom = (room: Room, from: string | null, depth: number): Promise<void> => {
    if (depth <= 0 || matches.length >= PROFILE_MAX_POSTS) return Promise.resolve();
    return pageRoomHistory(mx, room, from).then((page) => {
      collectInlineComments(room.roomId, page.events, inlineCounts, counted);
      const pinned = getPinnedEventIds(room);
      page.events.forEach((evt) => {
        if (!isPostEvent(evt) || evt.getSender() !== userId) return;
        const id = evt.getId();
        if (!id || seen.has(id)) return;
        seen.add(id);
        matches.push({
          roomId: room.roomId,
          eventId: id,
          root: evt,
          upvotes: 0,
          downvotes: 0,
          myVote: undefined,
          myReactionId: undefined,
          replyCount: 0,
          pinned: pinned.has(id),
        });
      });
      if (!page.nextToken) return Promise.resolve();
      return scanRoom(room, page.nextToken, depth - 1);
    });
  };

  await mapBatched(rooms, 5, (room) => scanRoom(room, null, PROFILE_PAGES_PER_ROOM));
  return mapBatched(matches, 8, (post) => enrichPost(mx, post, inlineCounts));
};

export function ProfilePage() {
  const mx = useMatrixClient();
  const { userId } = useParams();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const userPosts = await loadUserPosts(mx, userId);
    setPosts(userPosts);
    setLoading(false);
  }, [mx, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const applyVote = useCallback(
    (roomId: string, eventId: string, vote: PostVote) => {
      setPosts((prev) =>
        prev.map((post) => {
          if (post.roomId !== roomId || post.eventId !== eventId) return post;
          const next = togglePostVote(mx, roomId, eventId, post, vote);
          return { ...post, ...next };
        })
      );
    },
    [mx]
  );

  const userIdSafe = userId ?? '';
  const displayName = mx.getUser(userIdSafe)?.displayName ?? userIdSafe;
  const karma = posts.reduce((sum, post) => sum + getPostScore(post), 0);

  const renderContent = () => {
    if (loading && posts.length === 0) {
      return (
        <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
          <Spinner size="300" variant="Secondary" fill="Soft" />
        </Box>
      );
    }
    return (
      <Scroll variant="Background" direction="Vertical" size="300" hideTrack visibility="Hover">
        <Box
          direction="Column"
          gap="200"
          style={{
            maxWidth: toRem(760),
            margin: '0 auto',
            padding: config.space.S200,
          }}
        >
          {posts.length === 0 && (
            <Text size="T300" priority="400">
              No posts found for this user in the community.
            </Text>
          )}
          {posts.map((post) => (
            <FeedCard key={`${post.roomId}:${post.eventId}`} post={post} onVote={applyVote} />
          ))}
        </Box>
      </Scroll>
    );
  };

  return (
    <Page>
      <PageHeader balance outlined={false}>
        <Box grow="Yes" alignItems="Center" gap="200">
          <BackRouteHandler>
            {(onBack) => (
              <IconButton size="300" variant="Background" onClick={onBack}>
                <Icon size="100" src={Icons.ArrowLeft} />
              </IconButton>
            )}
          </BackRouteHandler>
          <Box grow="Yes">
            <Text size="H4" truncate>
              {displayName}
            </Text>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes" direction="Column" style={{ minHeight: 0 }}>
        <Box
          gap="200"
          alignItems="Center"
          style={{ padding: `${config.space.S100} ${config.space.S200}`, flexShrink: 0 }}
        >
          <Text size="T300" priority="400">
            Karma {karma}
          </Text>
          <Text size="T300" priority="300">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </Text>
        </Box>
        {renderContent()}
      </Box>
    </Page>
  );
}
