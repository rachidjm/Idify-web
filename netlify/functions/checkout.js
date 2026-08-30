import { readSessionEmail, json, humanError } from './_auth.js';
import { getUsuario, guardarUsuario, resumenPublico, registrarHistorial, PLANES } from './_usuarios.js';

/* MODO DEMO — ningún dato de pago real toca este endpoint. Simula el checkout
   marcando el plan como pagado y recargando créditos. Migrar a producción
   (18-go-live-playbooks.md) solo reescribe el interior de esta función. */
export default async (req) => {
  if (req.method !== 'POST') return humanError('Método no permitido.', 405);

  const email = readSessionEmail(req);
  if (!email) return humanError('Sesión no válida.', 401);

  let body;
  try {
    body = await req.json();
  } catch {
    return humanError('No pude leer los datos enviados.', 400);
  }

  const plan = body.plan;
  if (!PLANES[plan] || plan === 'gratis') return humanError('Plan no válido.', 400);

  const usuario = await getUsuario(email);
  if (!usuario) return humanError('Sesión no válida.', 401);

  usuario.plan = plan;
  usuario.creditos = PLANES[plan].creditos;
  usuario.renovacion = new Date(Date.now() + 30 * 86400000).toISOString();
  registrarHistorial(usuario, `checkout-${plan}-demo`, 0);
  await guardarUsuario(email, usuario);

  return json(resumenPublico(usuario, email));
};
