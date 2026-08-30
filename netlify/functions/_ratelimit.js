import { getStore } from '@netlify/blobs';

/* Límite simple por IP+acción, guardado en Blobs. No pretende ser exacto bajo
   alta concurrencia — solo evita el abuso más obvio de cuentas en bucle. */
export async function dentroDelLimite(clave, maximo, ventanaMs) {
  const s = getStore('ratelimits');
  const ahora = Date.now();
  const registro = (await s.get(clave, { type: 'json' })) || { cuenta: 0, inicio: ahora };

  if (ahora - registro.inicio > ventanaMs) {
    registro.cuenta = 0;
    registro.inicio = ahora;
  }
  registro.cuenta++;
  await s.setJSON(clave, registro);
  return registro.cuenta <= maximo;
}
