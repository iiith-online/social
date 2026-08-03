import { handleError, handleMatrixNotify, json } from '../server/pushGateway.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, {
      errcode: 'M_UNRECOGNIZED',
      error: 'Unrecognized request.',
    });
  }
  try {
    return json(res, 200, await handleMatrixNotify(req));
  } catch (error) {
    return handleError(res, error);
  }
}
