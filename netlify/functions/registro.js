import { hashPassword, signSession, sessionCookie, json, humanError } from './_auth.js';
import { getUsuario, crearUsuario, resumenPublico } from './_usuarios.js';
import { dentroDelLimite } from './_ratelimit.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req, context) => {
  if (req.method !== 'POST') return humanError('Método no permitido.', 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return humanError('No pude leer los datos enviados.', 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!EMAIL_RE.test(email)) return humanError('Escribe un email válido.', 400);
  if (password.length < 8) return humanError('La contraseña debe tener al menos 8 caracteres.', 400);

  const ip = context.ip || 'desconocida';
  const ok = await dentroDelLimite(`registro:${ip}`, 10, 15 * 60 * 1000);
  if (!ok) return humanError('Demasiados intentos. Prueba de nuevo en unos minutos.', 429);

  const existente = await getUsuario(email);
  if (existente) return humanError('Ya existe una cuenta con ese email.', 409);

  const hash = await hashPassword(password);
  const usuario = await crearUsuario(email, hash);
  const token = signSession(email);

  return json(resumenPublico(usuario, email), 200, { 'Set-Cookie': sessionCookie(token) });
};
