import { readSessionEmail, json, humanError } from './_auth.js';
import { getUsuario, renovarSiToca, guardarUsuario, resumenPublico } from './_usuarios.js';

export default async (req) => {
  if (req.method !== 'GET') return humanError('Método no permitido.', 405);

  const email = readSessionEmail(req);
  if (!email) return humanError('Sesión no válida.', 401);

  const usuario = await getUsuario(email);
  if (!usuario) return humanError('Sesión no válida.', 401);

  const antes = usuario.renovacion;
  const actualizado = renovarSiToca(usuario);
  if (actualizado.renovacion !== antes) await guardarUsuario(email, actualizado);

  return json(resumenPublico(actualizado, email));
};
