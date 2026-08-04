import { EventType, MatrixClient, RelationType } from 'matrix-js-sdk';

export const POST_UP_KEY = '👍';
export const POST_DOWN_KEY = '👎';

export type PostVote = 'up' | 'down';

export type PostVoteState = {
  upvotes: number;
  downvotes: number;
  myVote?: PostVote;
  myReactionId?: string;
};

export const getPostScore = (state: Pick<PostVoteState, 'upvotes' | 'downvotes'>): number =>
  state.upvotes - state.downvotes;

export const getPostVoteState = async (
  mx: MatrixClient,
  roomId: string,
  eventId: string
): Promise<PostVoteState> => {
  const me = mx.getSafeUserId();
  let upvotes = 0;
  let downvotes = 0;
  let myVote: PostVote | undefined;
  let myReactionId: string | undefined;

  try {
    const reactions = await mx.relations(roomId, eventId, RelationType.Annotation, EventType.Reaction);
    reactions.events.forEach((evt) => {
      if (evt.isRedacted()) return;
      const key = evt.getContent()?.['m.relates_to']?.key;
      const sender = evt.getSender();
      if (key === POST_UP_KEY) {
        upvotes += 1;
        if (sender === me) {
          myVote = 'up';
          myReactionId = evt.getId();
        }
      } else if (key === POST_DOWN_KEY) {
        downvotes += 1;
        if (sender === me) {
          myVote = 'down';
          myReactionId = evt.getId();
        }
      }
    });
  } catch {
    // no reactions visible
  }

  return { upvotes, downvotes, myVote, myReactionId };
};

// Toggles a 👍/👎 reaction vote on a post, redacting the previous vote if any.
// Returns the next vote state; the UI updates optimistically and a later
// refetch reconciles the reaction event ids.
export const togglePostVote = (
  mx: MatrixClient,
  roomId: string,
  eventId: string,
  state: PostVoteState,
  vote: PostVote
): PostVoteState => {
  if (state.myVote === vote) {
    if (state.myReactionId) mx.redactEvent(roomId, state.myReactionId);
    return {
      ...state,
      myVote: undefined,
      myReactionId: undefined,
      upvotes: Math.max(0, state.upvotes - (vote === 'up' ? 1 : 0)),
      downvotes: Math.max(0, state.downvotes - (vote === 'down' ? 1 : 0)),
    };
  }

  if (state.myVote && state.myReactionId) mx.redactEvent(roomId, state.myReactionId);
  mx.sendEvent(roomId, EventType.Reaction, {
    'm.relates_to': {
      rel_type: RelationType.Annotation,
      event_id: eventId,
      key: vote === 'up' ? POST_UP_KEY : POST_DOWN_KEY,
    },
  });

  const wasUp = state.myVote === 'up';
  const wasDown = state.myVote === 'down';
  return {
    ...state,
    myVote: vote,
    myReactionId: undefined, // unknown until next refetch
    upvotes: Math.max(0, state.upvotes + (vote === 'up' ? 1 : 0) - (wasUp ? 1 : 0)),
    downvotes: Math.max(0, state.downvotes + (vote === 'down' ? 1 : 0) - (wasDown ? 1 : 0)),
  };
};
