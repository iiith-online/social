import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClickUrl, renderNotification, sanitizeText } from './pushGateway.js';

test('renders private payloads without leaking message content', () => {
  const payload = renderNotification(
    {
      event_id: '$event',
      room_id: '!room:example.org',
      room_name: 'Private room',
      sender_display_name: 'Alice',
      type: 'm.room.message',
      content: { msgtype: 'm.text', body: 'secret text' },
      counts: { unread: 3 },
    },
    { clickBase: 'https://matrix.example.org', previewMode: 'private' }
  );

  assert.equal(payload.title, 'IIIT social');
  assert.equal(payload.body, 'New IIIT social notification');
  assert.equal(payload.unread, 3);
  assert.equal(payload.clickUrl, 'https://matrix.example.org/recent/!room%3Aexample.org/%24event/');
});

test('never renders encrypted ciphertext', () => {
  const payload = renderNotification(
    {
      event_id: '$event',
      room_id: '!room:example.org',
      room_name: 'Room',
      sender_display_name: 'Alice',
      type: 'm.room.encrypted',
      content: { ciphertext: 'do-not-render' },
    },
    { clickBase: 'https://matrix.example.org/#', previewMode: 'maximum' }
  );

  assert.equal(payload.body, 'Alice: Encrypted message');
  assert.equal(payload.roomId, '!room:example.org');
  assert.equal(payload.eventId, '$event');
  assert.equal(payload.encrypted, true);
  assert.equal(
    buildClickUrl('https://matrix.example.org/#', '!room:example.org', '$event'),
    'https://matrix.example.org/#/recent/!room%3Aexample.org/%24event/'
  );
  assert.equal(sanitizeText('hello\u0000   world'), 'hello world');
});
