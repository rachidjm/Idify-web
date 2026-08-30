import { clearSessionCookie, json, humanError } from './_auth.js';

export default async (req) => {
  if (req.method !== 'POST') return humanError('Método no permitido.', 405);
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
};
