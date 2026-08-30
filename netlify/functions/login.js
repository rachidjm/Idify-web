import { verifyPassword, signSession, sessionCookie, json, humanError } from './_auth.js';
import { getUsuario, renovarSiToca, guardarUsuario, resumenPublico } from './_usuarios.js';
import { dentroDelLimite } from './_ratelimit.js';

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

  const ip = context.ip || 'desconocida';
  const okLimite = await dentroDelLimite(`login:${ip}:${email}`, 5, 15 * 60 * 1000);
  if (!okLimite) return humanError('Demasiados intentos. Prueba de nuevo en unos minutos.', 429);

  const usuario = await getUsuario(email);
  if (!usuario) return humanError('Email o contraseña incorrectos.', 401);

  const valido = await verifyPassword(password, usuario.hash);
  if (!valido) return humanError('Email o contraseña incorrectos.', 401);

  const actualizado = renovarSiToca(usuario);
  await guardarUsuario(email, actualizado);

  const token = signSession(email);
  return json(resumenPublico(actualizado, email), 200, { 'Set-Cookie': sessionCookie(token) });
};
