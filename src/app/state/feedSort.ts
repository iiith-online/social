import { atom } from 'jotai';
import { FeedSort } from '../utils/feedSort';

// Which feed is shown at /home/; the sidebar feed tabs and the in-feed
// sort chips both read and write it.
export const feedSortAtom = atom<FeedSort>('recommended');
