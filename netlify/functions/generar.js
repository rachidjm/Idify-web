import { readSessionEmail, json, humanError } from './_auth.js';
import { getUsuario, renovarSiToca, guardarUsuario, registrarHistorial, PLANES } from './_usuarios.js';
import { parseJSONSeguro } from './_claude.js';
import { llamarIA } from './_ia.js';
import {
  systemPromptUnificado,
  systemSkillUnificado,
  NIVEL_COSTE,
  CATEGORIAS_SKILL,
  conPlantillaDePartida,
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
  if (!idea) return humanError('Cuéntame tu idea antes de generar.', 400);

  const usuario = await getUsuario(email);
  if (!usuario) return humanError('Sesión no válida.', 401);
  renovarSiToca(usuario);

  if (preset === 'prompt') return generarPrompt(email, usuario, idea);
  return generarSkill(email, usuario, idea, plantilla);
};

/* Prompt normal: 1 crédito fijo, gratis mientras tengas créditos de bienvenida.
   Una sola llamada: extrae secciones Y redacta el prompt final a la vez. */
async function generarPrompt(email, usuario, idea) {
  if (usuario.creditos < 1) {
    return json({ error: 'No te quedan créditos.', requiereUpgrade: true, planes: PLANES }, 402);
  }

  usuario.creditos -= 1;
  await guardarUsuario(email, usuario);

  try {
    const raw = await llamarIA(systemPromptUnificado(), idea, { json: true, maxTokens: 3000 });
    const data = parseJSONSeguro(raw);
    const secciones = data.secciones || [];
    const resultado_final = data.resultado_final || '';

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

/* Skill: una sola llamada que extrae secciones, clasifica nivel/categoría, Y redacta el
   SKILL.md (con sus archivos si es nivel difícil) a la vez. Como el nivel (y por tanto el
   coste) no se sabe hasta que la IA responde, el orden es: generar primero -> calcular el
   coste según lo que salió -> si al usuario no le llegan los créditos para ese nivel, no
   se le cobra nada y se le ofrece mejorar el plan -> si le llegan, se descuentan de verdad
   (nunca gratis con créditos de bienvenida, sea cual sea el plan). */
async function generarSkill(email, usuario, idea, plantilla) {
  let secciones, nivel, categoria, resultado_final, archivos;
  try {
    const systemFinal = conPlantillaDePartida(systemSkillUnificado(), plantilla);
    const mensajeUsuario = plantilla
      ? `Secciones de la plantilla de partida:\n${JSON.stringify(plantilla)}\n\nLo que dijo el usuario:\n${idea}`
      : idea;
    const raw = await llamarIA(systemFinal, mensajeUsuario, { json: true, maxTokens: 4096 });
    const data = parseJSONSeguro(raw);

    secciones = data.secciones || [];
    nivel = NIVELES_VALIDOS.includes(data.nivel) ? data.nivel : 'facil';
    categoria = CATEGORIAS_SKILL.includes(data.categoria) ? data.categoria : 'personalizado';
    resultado_final = data.resultado_final || '';
    archivos = nivel === 'dificil' && Array.isArray(data.archivos) ? data.archivos : null;
  } catch (e) {
    console.error('generar.js (skill) failed', e);
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
  registrarHistorial(usuario, `generar-skill-${nivel}`, coste);
  await guardarUsuario(email, usuario);

  // "Prompt para usar esta skill" se construye sin IA en el cliente (ver app.js,
  // construirPromptDeUso) — la Capa 3 que lo redactaba con IA está desactivada, ver
  // el comentario en _prompts.js (systemPromptDeUso).
  return json({ secciones, resultado_final, archivos, nivel, categoria, coste, promptDeUso: null, creditos: usuario.creditos });
}
