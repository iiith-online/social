import { handleError, json, sendTest } from '../../server/pushGateway.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    await sendTest(req);
    return json(res, 200, { ok: true });
  } catch (error) {
    return handleError(res, error);
  }
}
