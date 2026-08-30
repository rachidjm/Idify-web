import { readSessionEmail, json, humanError } from './_auth.js';
import { getUsuario, renovarSiToca, guardarUsuario, registrarHistorial, PLANES } from './_usuarios.js';
import { parseJSONSeguro } from './_claude.js';
import { llamarIA } from './_ia.js';
import {
  systemExtraccion,
  systemRedaccion,
  systemRedaccionSkillDetallada,
  systemRedaccionSkillPaquete,
  NIVEL_COSTE,
  CATEGORIAS_SKILL,
  conEnfoquePorCategoria,
  conPlantillaDePartida,
  systemPromptDeUso,
} from './_prompts.js';

const IDEA_MAX_LEN = 4000;
const NIVELES_VALIDOS = ['facil', 'media', 'dificil'];

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

  const idea = String(body.idea || '').trim().slice(0, IDEA_MAX_LEN);
  const preset = body.preset === 'skill' ? 'skill' : 'prompt';
  const plantilla = preset === 'skill' && Array.isArray(body.plantilla) ? body.plantilla : null;
  const plantillaId = preset === 'skill' && typeof body.plantillaId === 'string' ? body.plantillaId : null;
  if (!idea) return humanError('Cuéntame tu idea antes de generar.', 400);

  const usuario = await getUsuario(email);
  if (!usuario) return humanError('Sesión no válida.', 401);
  renovarSiToca(usuario);

  if (preset === 'prompt') return generarPrompt(email, usuario, idea);
  return generarSkill(email, usuario, idea, plantilla, plantillaId);
};

/* Prompt normal: 1 crédito fijo, gratis mientras tengas créditos de bienvenida — comportamiento sin cambios. */
async function generarPrompt(email, usuario, idea) {
  if (usuario.creditos < 1) {
    return json({ error: 'No te quedan créditos.', requiereUpgrade: true, planes: PLANES }, 402);
  }

  usuario.creditos -= 1;
  await guardarUsuario(email, usuario);

  try {
    const rawExtraccion = await llamarIA(systemExtraccion('prompt'), idea, { json: true });
    const secciones = parseJSONSeguro(rawExtraccion).secciones || [];
    const resultado_final = await llamarIA(systemRedaccion('prompt'), JSON.stringify(secciones));

    registrarHistorial(usuario, 'generar-prompt', 1);
    await guardarUsuario(email, usuario);

    return json({ secciones, resultado_final, creditos: usuario.creditos });
  } catch (e) {
    console.error('generar.js (prompt) failed', e);
    usuario.creditos += 1;
    await guardarUsuario(email, usuario);
    return humanError('Ahora mismo no puedo procesarlo. Inténtalo de nuevo en un momento.', 502);
  }
}

/* Skill: la Capa 1 detecta también el nivel de dificultad (facil/media/dificil).
   El coste depende del nivel y SIEMPRE se descuenta de verdad, sin gratis de bienvenida.
   Orden: extraer (barato, incluye el nivel) -> calcular coste -> comprobar créditos ANTES
   de generar el resultado caro -> si no llegan, no se ejecuta nada más -> si llegan, se
   descuentan y se genera -> si falla después de descontar, se reembolsa. */
async function generarSkill(email, usuario, idea, plantilla, plantillaId) {
  let secciones, nivel, categoria;
  try {
    const systemExtraccionFinal = conPlantillaDePartida(systemExtraccion('skill'), plantilla);
    const mensajeUsuario = plantilla
      ? `Secciones de la plantilla de partida:\n${JSON.stringify(plantilla)}\n\nLo que dijo el usuario:\n${idea}`
      : idea;
    const rawExtraccion = await llamarIA(systemExtraccionFinal, mensajeUsuario, { json: true });
    const extraido = parseJSONSeguro(rawExtraccion);
    secciones = extraido.secciones || [];
    nivel = NIVELES_VALIDOS.includes(extraido.nivel) ? extraido.nivel : 'facil';
    categoria = CATEGORIAS_SKILL.includes(extraido.categoria) ? extraido.categoria : 'personalizado';
  } catch (e) {
    console.error('generar.js (extracción skill) failed', e);
    return humanError('Ahora mismo no puedo procesarlo. Inténtalo de nuevo en un momento.', 502);
  }

  const coste = NIVEL_COSTE[nivel];
  if (usuario.creditos < coste) {
    return json(
      {
        error: `Esta skill es de nivel ${nivel} y cuesta ${coste} créditos — no te llegan.`,
        requiereUpgrade: true,
        planes: PLANES,
        nivel,
        coste,
      },
      402,
    );
  }

  usuario.creditos -= coste;
  await guardarUsuario(email, usuario);

  try {
    let resultado_final;
    let archivos = null;

    if (nivel === 'facil') {
      resultado_final = await llamarIA(conEnfoquePorCategoria(systemRedaccion('skill'), categoria), JSON.stringify(secciones));
    } else if (nivel === 'media') {
      resultado_final = await llamarIA(conEnfoquePorCategoria(systemRedaccionSkillDetallada(), categoria), JSON.stringify(secciones));
    } else {
      const rawPaquete = await llamarIA(conEnfoquePorCategoria(systemRedaccionSkillPaquete(), categoria), JSON.stringify(secciones), { json: true });
      const paquete = parseJSONSeguro(rawPaquete);
      resultado_final = paquete.skillMd || '';
      archivos = Array.isArray(paquete.archivos) ? paquete.archivos : [];
    }

    // Capa 3 (mejor esfuerzo, no gasta crédito aparte ni hace fallar la generación si
    // se cae): redacta la caja "Prompt para usar esta skill" con el mismo nivel de
    // detalle que un ejemplo real de esa skill, sin copiar su nicho ni sus datos.
    let promptDeUso = null;
    const systemUso = plantillaId ? systemPromptDeUso(plantillaId) : null;
    if (systemUso) {
      try {
        promptDeUso = await llamarIA(systemUso, JSON.stringify(secciones));
      } catch (e) {
        console.warn('generar.js (prompt de uso) falló, se usa el texto local sin IA', e.message);
      }
    }

    registrarHistorial(usuario, `generar-skill-${nivel}`, coste);
    await guardarUsuario(email, usuario);

    return json({ secciones, resultado_final, archivos, nivel, categoria, coste, promptDeUso, creditos: usuario.creditos });
  } catch (e) {
    console.error('generar.js (redacción skill) failed', e);
    usuario.creditos += coste;
    await guardarUsuario(email, usuario);
    return humanError('Ahora mismo no puedo procesarlo. Inténtalo de nuevo en un momento.', 502);
  }
}
