import { readSessionEmail, json, humanError } from './_auth.js';
import { getUsuario, registrarHistorial, guardarUsuario } from './_usuarios.js';
import { llamarIA } from './_ia.js';
import { systemRedaccion, SYSTEM_CORRECCION, mensajeCorreccion } from './_prompts.js';

const CORRECCION_MAX_LEN = 1000;

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

  const secciones = Array.isArray(body.secciones) ? body.secciones : null;
  const id = String(body.id || '');
  const correccion = String(body.correccion || '').trim().slice(0, CORRECCION_MAX_LEN);
  const fragmento = String(body.fragmento || '').trim().slice(0, 500);
  const preset = body.preset === 'skill' ? 'skill' : 'prompt';

  if (!secciones || !id || !correccion) return humanError('Faltan datos para aplicar la corrección.', 400);

  const seccion = secciones.find((s) => s.id === id);
  if (!seccion) return humanError('No encuentro esa sección.', 400);

  const usuario = await getUsuario(email);
  if (!usuario) return humanError('Sesión no válida.', 401);

  try {
    // Corregir una sección es siempre gratis, en cualquier plan.
    seccion.contenido = await llamarIA(SYSTEM_CORRECCION, mensajeCorreccion(seccion.titulo, seccion.contenido, correccion, fragmento || undefined));
    const resultado_final = await llamarIA(systemRedaccion(preset), JSON.stringify(secciones));

    registrarHistorial(usuario, `corregir-${preset}`, 0);
    await guardarUsuario(email, usuario);

    return json({ secciones, resultado_final });
  } catch (e) {
    console.error('corregir.js failed', e);
    return humanError('No pude aplicar la corrección. Inténtalo de nuevo en un momento.', 502);
  }
};
