import { getPublicConfig, handleError, json } from '../../server/pushGateway.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  try {
    return json(res, 200, await getPublicConfig(req));
  } catch (error) {
    return handleError(res, error);
  }
}
