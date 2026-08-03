import {
  deleteSubscription,
  handleError,
  json,
  upsertSubscription,
} from '../../server/pushGateway.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return json(res, 200, await upsertSubscription(req));
    if (req.method === 'DELETE') {
      await deleteSubscription(req);
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    return handleError(res, error);
  }
}
