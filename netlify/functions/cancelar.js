import { readSessionEmail, json, humanError } from './_auth.js';
import { getUsuario, guardarUsuario, resumenPublico, registrarHistorial, PLANES } from './_usuarios.js';

/* MODO DEMO. En producción esto abriría el portal del cliente de la pasarela real. */
export default async (req) => {
  if (req.method !== 'POST') return humanError('Método no permitido.', 405);

  const email = readSessionEmail(req);
  if (!email) return humanError('Sesión no válida.', 401);

  const usuario = await getUsuario(email);
  if (!usuario) return humanError('Sesión no válida.', 401);

  usuario.plan = 'gratis';
  usuario.renovacion = null;
  // Nunca dejar más créditos de los que el plan gratis permite mostrar (ej. "200 / 3").
  usuario.creditos = Math.min(usuario.creditos, PLANES.gratis.creditos);
  registrarHistorial(usuario, 'cancelar-demo', 0);
  await guardarUsuario(email, usuario);

  return json(resumenPublico(usuario, email));
};
