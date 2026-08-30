/* Los tres prompts maestros de reference/06-recipe-voz-a-prompt.md, verbatim. */

export function systemExtraccion(preset) {
  if (preset === 'skill') {
    return `Eres un extractor de información para un sistema que genera Claude Skills. El usuario describe, hablado, un flujo de trabajo que quiere convertir en skill. Organízalo en secciones claras, sin relleno. Además, clasifica la dificultad de esa skill en "facil", "media" o "dificil": "facil" si es un flujo simple de un solo propósito; "media" si tiene varios pasos con matices o casos especiales; "dificil" si necesitaría archivos de apoyo (plantillas, scripts o documentación de referencia) además del SKILL.md para funcionar bien. Clasifica también la idea en UNA categoría: "automatizacion_servicio" (bots o flujos de atención al cliente y soporte), "creacion_pagina_producto" (páginas de venta, landing pages o fichas de producto), "automatizacion_meta_ads" (anuncios de Facebook/Instagram, segmentación de audiencia o campañas), o "personalizado" si no encaja claramente en ninguna de las anteriores — no fuerces una categoría que no corresponda. Devuelve SOLO un JSON, sin texto adicional ni backticks:
{"nivel":"facil|media|dificil","categoria":"automatizacion_servicio|creacion_pagina_producto|automatizacion_meta_ads|personalizado","secciones":[{"id":"nombre","titulo":"Nombre de la skill","contenido":"..."},{"id":"activacion","titulo":"Cuándo se activa","contenido":"..."},{"id":"pasos","titulo":"Pasos a seguir","contenido":"..."},{"id":"restricciones","titulo":"Restricciones","contenido":"..."},{"id":"formato","titulo":"Formato de salida","contenido":"..."}]}
Si falta información, complétala con una suposición razonable y añade " (supuesto)" al final de esa sección. Responde en el mismo idioma en que habló el usuario.`;
  }
  return `Eres un extractor de información para un sistema que genera prompts de IA. El usuario te da una idea hablada o escrita, a veces desordenada. Organízala en secciones claras, conservando detalles relevantes, eliminando solo relleno y muletillas. Devuelve SOLO un JSON, sin texto adicional ni backticks:
{"secciones":[{"id":"rol","titulo":"Rol","contenido":"..."},{"id":"contexto","titulo":"Contexto","contenido":"..."},{"id":"tarea","titulo":"Tarea principal","contenido":"..."},{"id":"restricciones","titulo":"Restricciones","contenido":"..."},{"id":"formato","titulo":"Formato de salida","contenido":"..."}]}
Si falta información, complétala con tu mejor suposición razonable y añade " (supuesto)" al final de esa sección. Responde en el mismo idioma en que habló el usuario.`;
}

export function systemRedaccion(preset) {
  if (preset === 'skill') {
    return `Eres un experto en crear Claude Skills. A partir de las secciones ya organizadas, genera el contenido completo de un archivo SKILL.md: frontmatter con "name" y "description" (específica, para que Claude sepa activarla en el momento correcto), y cuerpo con cuándo se usa, pasos, restricciones y formato de salida. Responde SOLO con el contenido final del SKILL.md, sin explicaciones ni backticks, en el mismo idioma de las secciones.`;
  }
  return `Eres un experto en prompt engineering. A partir de las secciones ya organizadas, escribe UN prompt profesional, fluido y bien estructurado, listo para copiar y pegar en Claude u otro LLM. Responde SOLO con el texto final del prompt, sin explicaciones ni backticks, en el mismo idioma de las secciones.`;
}

export const SYSTEM_CORRECCION = `Eres un asistente que corrige una sección específica de un análisis. Te doy el título, el contenido actual, y una corrección del usuario. Devuelve SOLO el nuevo contenido corregido: texto plano, sin comillas, sin JSON, sin explicaciones.`;

export function mensajeCorreccion(titulo, contenidoActual, correccion, fragmento) {
  let msg = `Sección: ${titulo}\nContenido actual: ${contenidoActual}\n`;
  if (fragmento) msg += `Fragmento exacto que el usuario señaló como incorrecto: "${fragmento}"\n`;
  msg += `Corrección del usuario: ${correccion}`;
  return msg;
}

/* Coste en créditos según el nivel de dificultad detectado para una skill (ver systemExtraccion). */
export const NIVEL_COSTE = { facil: 1, media: 2, dificil: 5 };

export function systemRedaccionSkillDetallada() {
  return `Eres un experto en crear Claude Skills. A partir de las secciones ya organizadas, genera el contenido completo de un archivo SKILL.md, con más detalle del habitual: frontmatter con "name" y "description" (específica, para que Claude sepa activarla en el momento correcto), y un cuerpo desarrollado con matices en los pasos, casos especiales en las restricciones, y al menos un ejemplo concreto de uso. Responde SOLO con el contenido final del SKILL.md, sin explicaciones ni backticks, en el mismo idioma de las secciones.`;
}

export function systemRedaccionSkillPaquete() {
  return `Eres un experto en crear Claude Skills complejas que necesitan archivos de apoyo además del SKILL.md principal. A partir de las secciones ya organizadas, genera el SKILL.md (frontmatter con "name" y "description" específica) y los archivos adicionales de reference/, templates/ o scripts/ que esa skill necesite para funcionar bien. Devuelve SOLO un JSON, sin texto adicional ni backticks:
{"skillMd":"contenido completo del SKILL.md","archivos":[{"ruta":"reference/ejemplo.md","contenido":"..."}]}
Usa rutas relativas que empiecen por reference/, templates/ o scripts/. Responde en el mismo idioma de las secciones.`;
}

/* Categoría detectada por la Capa 1 (ver systemExtraccion) -> instrucción extra para la
   Capa 2, que ajusta el enfoque del SKILL.md sin cambiar el motor genérico ya existente.
   "personalizado" no añade nada — usa exactamente el motor genérico, tal cual. */
export const CATEGORIAS_SKILL = ['automatizacion_servicio', 'creacion_pagina_producto', 'automatizacion_meta_ads', 'personalizado'];

const ENFOQUE_CATEGORIA = {
  automatizacion_servicio: 'Pon énfasis en el tono de respuesta, en casos de uso de atención al cliente, y en cuándo escalar la conversación a un humano.',
  creacion_pagina_producto: 'Pon énfasis en la estructura de contenido, en SEO básico y en las llamadas a la acción.',
  automatizacion_meta_ads: 'Pon énfasis en la segmentación de audiencia, en los formatos de anuncio y en las métricas que hay que vigilar.',
  personalizado: '',
};

export function conEnfoquePorCategoria(systemBase, categoria) {
  const enfoque = ENFOQUE_CATEGORIA[categoria];
  return enfoque ? systemBase + '\n\n' + enfoque : systemBase;
}

/* Plantilla de partida elegida por el usuario ANTES de hablar (ver app.js, PLANTILLAS_SKILL).
   La Capa 1 debe ajustarla/completarla con lo que diga, sin perder lo que no contradiga. */
export function conPlantillaDePartida(systemBase, plantilla) {
  if (!plantilla) return systemBase;
  return systemBase + '\n\nEl usuario ha elegido una plantilla de partida ya rellena, con sus propias secciones. Ajusta y completa esas secciones con lo que diga a continuación: conserva el contenido de la plantilla en todo lo que no contradiga, y sustituye solo la parte que el usuario contradiga explícitamente con su voz.';
}
