import { getStore } from '@netlify/blobs';

/* Precios de ejemplo — sin cerrar todavía con Rachid, ver intake-template.md */
export const PLANES = {
  gratis: { nombre: 'Gratis', creditos: 10, precio: 0 },
  pro: { nombre: 'Pro', creditos: 200, precio: 19 },
  empresa: { nombre: 'Empresa', creditos: 1000, precio: 59 },
};

function store() {
  return getStore('usuarios');
}

export async function getUsuario(email) {
  return store().get(email.toLowerCase(), { type: 'json' });
}

export async function guardarUsuario(email, datos) {
  return store().setJSON(email.toLowerCase(), datos);
}

export async function crearUsuario(email, hash) {
  const ahora = new Date().toISOString();
  const usuario = {
    hash,
    plan: 'gratis',
    creditos: PLANES.gratis.creditos,
    renovacion: null,
    creado: ahora,
    historial: [{ fecha: ahora, accion: 'registro', coste: 0 }],
  };
  await guardarUsuario(email, usuario);
  return usuario;
}

/* Plan de pago con renovación vencida → recarga créditos, mismo comportamiento que producirá el webhook real. */
export function renovarSiToca(usuario) {
  if (usuario.plan === 'gratis' || !usuario.renovacion) return usuario;
  if (new Date(usuario.renovacion) <= new Date()) {
    usuario.creditos = PLANES[usuario.plan].creditos;
    usuario.renovacion = new Date(Date.now() + 30 * 86400000).toISOString();
    usuario.historial.unshift({ fecha: new Date().toISOString(), accion: 'renovacion', coste: 0 });
  }
  return usuario;
}

export function resumenPublico(usuario, email) {
  return {
    email,
    plan: usuario.plan,
    planNombre: PLANES[usuario.plan]?.nombre || usuario.plan,
    creditos: usuario.creditos,
    renovacion: usuario.renovacion,
    historial: (usuario.historial || []).slice(0, 20),
  };
}

export function registrarHistorial(usuario, accion, coste) {
  usuario.historial = usuario.historial || [];
  usuario.historial.unshift({ fecha: new Date().toISOString(), accion, coste });
}
