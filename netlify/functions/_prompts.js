/* Prompts unificados: cada operación (generar, corregir) es UNA sola llamada a la IA
   en vez de dos seguidas. Antes eran dos pasos (extraer -> redactar), pero en producción
   la segunda llamada seguida a la misma API se colgaba sin responder de forma 100%
   reproducible (confirmado con logs: la primera siempre iba bien, la segunda se colgaba
   siempre, con distintos prompts y distintos días) — un fallo de la infraestructura, no
   del contenido del prompt. Unificar en una sola llamada elimina el problema de raíz. */

export function systemPromptUnificado() {
  return `Eres un experto en prompt engineering. A partir de una idea hablada o escrita por el usuario, a veces desordenada, debes hacer dos cosas en una sola respuesta: (1) organizarla en secciones claras, conservando detalles relevantes, eliminando solo relleno y muletillas; (2) escribir a partir de esas secciones UN prompt profesional, fluido y bien estructurado, listo para copiar y pegar en Claude u otro LLM.

Devuelve SOLO un JSON, sin texto adicional ni backticks:
{"secciones":[{"id":"rol","titulo":"Rol","contenido":"..."},{"id":"contexto","titulo":"Contexto","contenido":"..."},{"id":"tarea","titulo":"Tarea principal","contenido":"..."},{"id":"restricciones","titulo":"Restricciones","contenido":"..."},{"id":"formato","titulo":"Formato de salida","contenido":"..."}],"resultado_final":"texto final del prompt, en texto plano dentro del JSON"}

Si falta información, complétala con tu mejor suposición razonable y añade " (supuesto)" al final de esa sección. Responde en el mismo idioma en que habló el usuario.`;
}

/* Coste en créditos según el nivel de dificultad que la IA detecta para una skill. */
export const NIVEL_COSTE = { facil: 1, media: 2, dificil: 5 };
export const CATEGORIAS_SKILL = ['automatizacion_servicio', 'creacion_pagina_producto', 'automatizacion_meta_ads', 'personalizado'];

export function systemSkillUnificado() {
  return `Eres un experto en construir Claude Skills a partir de la idea hablada o escrita de un usuario. En una sola respuesta debes: (1) organizar la idea en secciones claras, sin relleno; (2) clasificar la dificultad de la skill; (3) clasificar la idea en una categoría; (4) redactar directamente el contenido final del archivo SKILL.md a partir de esas secciones.

Dificultad — clasifícala en "facil", "media" o "dificil":
- "facil": flujo simple de un solo propósito. El SKILL.md es el contenido habitual: frontmatter con "name" y "description" específica, y cuerpo con cuándo se usa, pasos, restricciones y formato de salida.
- "media": tiene varios pasos con matices o casos especiales. Redacta el SKILL.md con más detalle de lo habitual: matices en los pasos, casos especiales en las restricciones, y al menos un ejemplo concreto de uso.
- "dificil": necesitaría archivos de apoyo (plantillas, scripts o documentación de referencia) además del SKILL.md para funcionar bien de verdad. Genera también esos archivos adicionales.

Categoría — clasifica la idea en UNA de estas cuatro, y ajusta el enfoque del SKILL.md según cuál sea (si es "personalizado", no añadas ningún enfoque especial, usa el planteamiento genérico de arriba tal cual):
- "automatizacion_servicio" (bots o flujos de atención al cliente y soporte): pon énfasis en el tono de respuesta, en casos de uso de atención al cliente, y en cuándo escalar la conversación a un humano.
- "creacion_pagina_producto" (páginas de venta, landing pages o fichas de producto): pon énfasis en la estructura de contenido, en SEO básico y en las llamadas a la acción.
- "automatizacion_meta_ads" (anuncios de Facebook/Instagram, segmentación de audiencia o campañas): pon énfasis en la segmentación de audiencia, en los formatos de anuncio y en las métricas que hay que vigilar.
- "personalizado": si no encaja claramente en ninguna de las anteriores — no fuerces una categoría que no corresponda.

Devuelve SOLO un JSON, sin texto adicional ni backticks:
{"nivel":"facil|media|dificil","categoria":"automatizacion_servicio|creacion_pagina_producto|automatizacion_meta_ads|personalizado","secciones":[{"id":"nombre","titulo":"Nombre de la skill","contenido":"..."},{"id":"activacion","titulo":"Cuándo se activa","contenido":"..."},{"id":"pasos","titulo":"Pasos a seguir","contenido":"..."},{"id":"restricciones","titulo":"Restricciones","contenido":"..."},{"id":"formato","titulo":"Formato de salida","contenido":"..."}],"resultado_final":"contenido completo del SKILL.md, en texto plano dentro del JSON","archivos":[{"ruta":"reference/ejemplo.md","contenido":"..."}]}

El campo "archivos" solo lleva elementos si el nivel es "dificil" (rutas que empiecen por reference/, templates/ o scripts/); en los demás niveles, usa un array vacío [].

Si falta información en la idea del usuario, complétala con una suposición razonable y añade " (supuesto)" al final de esa sección. Responde en el mismo idioma en que habló el usuario.`;
}

/* Plantilla de partida elegida por el usuario ANTES de hablar (ver app.js, PLANTILLAS_SKILL).
   La IA debe ajustarla/completarla con lo que diga, sin perder lo que no contradiga. */
export function conPlantillaDePartida(systemBase, plantilla) {
  if (!plantilla) return systemBase;
  return systemBase + '\n\nEl usuario ha elegido una plantilla de partida ya rellena, con sus propias secciones. Ajusta y completa esas secciones con lo que diga a continuación: conserva el contenido de la plantilla en todo lo que no contradiga, y sustituye solo la parte que el usuario contradiga explícitamente con su voz.';
}

/* Corrección: corrige la sección señalada Y redacta de nuevo el resultado final completo
   en la misma llamada (antes eran dos llamadas seguidas — mismo problema de fondo). */
export function systemCorreccionUnificada(preset) {
  const tipo = preset === 'skill' ? 'el archivo SKILL.md' : 'el prompt final';
  return `Eres un asistente que corrige una sección específica de un análisis ya organizado en secciones, y que después redacta de nuevo ${tipo} completo a partir de esas secciones (igual que se redactó la primera vez). Te doy todas las secciones actuales, cuál hay que corregir, y la corrección del usuario — puede venir en texto o dictada por voz, y puede señalar un fragmento exacto que está mal. Corrige SOLO el contenido de esa sección, sin tocar las demás.

Devuelve SOLO un JSON, sin texto adicional ni backticks:
{"secciones":[{"id":"...","titulo":"...","contenido":"..."}],"resultado_final":"..."}

El array "secciones" debe tener exactamente las mismas secciones que te doy, en el mismo orden y la misma cantidad — solo cambia el contenido de la sección corregida. Responde en el mismo idioma de las secciones.`;
}

export function mensajeCorreccionUnificada(secciones, idSeccion, correccion, fragmento) {
  const seccion = secciones.find((s) => s.id === idSeccion) || {};
  let msg = `Secciones actuales:\n${JSON.stringify(secciones)}\n\nSección a corregir: id "${idSeccion}" (${seccion.titulo || ''})\n`;
  if (fragmento) msg += `Fragmento exacto que el usuario señaló como incorrecto: "${fragmento}"\n`;
  msg += `Corrección del usuario: ${correccion}`;
  return msg;
}

/* Ejemplo real de petición de un usuario DISTINTO para cada una de las 5 skills de
   "Base Idify Skills" — se usan SOLO como referencia de estructura y nivel de detalle
   para la Capa 3 (ver systemPromptDeUso), nunca se copian ni se muestran al usuario. */
const PLANTILLA_REFERENCIA = {
  afiliados_amazon: `Quiero crear una web de afiliados de Amazon enfocada a bicicletas eléctricas, para el Amazon de España. La idea es que no sea una simple lista de productos, sino una web de comparativas tipo blog especializado: cada bici tiene su propia ficha completa con una galería de fotos, una tabla con todas sus características técnicas (autonomía, potencia, batería, peso, velocidad, tiempo de carga, etc.), un gráfico de valoraciones tipo radar, un texto explicando el producto con sus pros y sus contras y para quién es ideal, y un resumen de las reseñas. Que cada botón de "comprar" lleve a Amazon con mi enlace de afiliado. Si al extraer la información de Amazon te falta información, complementalo buscando la ficha en la web oficial o en reseñas por blogs y foros de ese modelo.

La estrella tiene que ser el comparador: que pueda elegir varias bicis y ver una tabla enfrentándolas lado a lado, con sus gráficos superpuestos, para decidir cuál me conviene. Quiero también página de inicio con las destacadas, páginas por categoría (ciudad, montaña, plegables, trekking…), alguna guía de compra tipo "mejor bici eléctrica para ciudad 2026" para que la web salga en Google, una sección de ofertas y el aviso legal de afiliados. Diseño premium y bien cuidado, mucho mejor que una plantilla, con el código bien organizado por dentro. Debe ser mobile responsive.

De momento pon solo estos enlaces para ver como queda: [enlaces de afiliado de ejemplo]. Cuando la tengas lista, dime que te pase más enlaces de afiliado y a partir de ahí ya la llenamos con más bicis. Publícala con un dominio temporal cuando esté montada y pásame el enlace.`,

  web_cliente: `Quiero crear una web premium para vendérsela a una empresa de instalación de paneles solares residenciales. El público objetivo son propietarios de vivienda unifamiliar preocupados por el precio de la luz. Necesito una landing con diseño de agencia, nada de plantilla genérica: un hero potente, una sección de ventajas de la energía solar, una sección de "cómo funciona", testimonios (invéntalos de momento y márcalos como de ejemplo, luego los cambiaremos por reales), preguntas frecuentes y un apartado de contacto. Colores verdes y azules oscuros, que transmitan confianza y sostenibilidad. Quiero que parezca una web de $30.000, con efectos, animaciones y composiciones increíbles, y que sea mobile responsive. Rellénala con imágenes generadas con IA para que el acabado sea profesional y coherente.

Y ahora lo que de verdad la hace vendible, dos funciones de inteligencia artificial: primero, un asistente de chat que responda a los visitantes sus dudas sobre energía solar (autoconsumo, ahorro, instalación, subvenciones…) y les invite a pedir un estudio gratis. Y segundo, una calculadora de ahorro interactiva: el usuario sube una foto o PDF de su factura de la luz, la IA extrae su consumo y su gasto, introduce su dirección, dibuja la zona de su tejado sobre un mapa para ver cuántas placas caben, y al final —tras pedirle su email— le muestra un estudio de rentabilidad personalizado (ahorro anual estimado y en cuántos años lo amortiza), guardando ese email como contacto para la empresa. Deja claro que es una estimación orientativa.

Para el asistente y la calculadora usaremos la IA de Google (Gemini), que tiene una clave gratuita; pídemela cuando llegues a ese paso. Cuando la tengas lista, publícala con un dominio temporal y pásame el enlace.`,

  micro_saas: `Quiero crear una web que sea un generador de códigos QR para imprimir en 3D. El funcionamiento: el usuario pega el enlace que quiera —la carta de un restaurante, su página de reseñas de Google, su Instagram, la wifi del local, su web…— y personaliza el diseño del QR (colores, formas de los puntos, y su logo o un emoji en el centro), pudiendo descargarlo como imagen normal en PNG o SVG. Y ahora lo diferencial: quiero que también pueda descargarlo como archivo 3D para imprimir, eligiendo entre varios formatos de objeto: un soporte de mesa, un llavero con su agujero para la anilla, y una placa para colgar en la pared. La descarga debe ser en formato 3MF, con dos colores que el usuario escoge —uno para la base y otro para el QR en relieve— de forma que el código tenga contraste real para poderse escanear con el móvil. Vista previa en 3D girable con el ratón antes de descargar. Añade también una descarga en STL para impresoras antiguas.

La web se monetizará con publicidad, así que deja huecos de anuncios como placeholders en distintos formatos y posiciones. Nada de anuncios reales, solo los huecos marcados. La herramienta debe poder usarse nada más entrar, sin registros. Añade debajo una sección de cómo funciona en 3 pasos, una sección de ideas de uso, y unas preguntas frecuentes. Optimízala para que posicione en Google con búsquedas del tipo de esta herramienta. Diseño limpio y profesional, mobile responsive. Cuando la tengas, publícala con un dominio temporal y pásame el enlace.`,

  portfolio: `Quiero crear mi portafolio personal. Me llamo [nombre], soy [profesión/rol] de [ciudad, año de nacimiento]. [Un par de líneas con el dato más impresionante de tu trayectoria: audiencia, cifras, años de experiencia]. Quiero una web premium que genere confianza a quien la vea, con un diseño espectacular que destaque muchísimo sobre un CV en PDF: sobrio y elegante pero muy top, con efectos actuales y buenas composiciones.

Secciones que quiero: un hero con mi nombre, mis roles y mi dato más fuerte; una banda de cifras destacadas; mi historia de origen; una sección de "lo que hago hoy" con mis pilares principales; una línea de tiempo con mis hitos reales; una sección de prensa si la tengo; contenido incrustado de mi canal o perfil si lo tengo; un manifiesto breve con mi propósito; una sección de colaboraciones o ecosistemas con los que trabajo; y un contacto dividido por motivo con mis correos reales.

Diseño acorde a mi sector y personalidad, mobile responsive, y que se vea impecable. Cuando lo tengas montado, publícalo con un dominio temporal y pásame el enlace.`,

  saas_suscripcion: `Quiero crear un SaaS que [qué hace exactamente el producto de IA, con qué tipo de documento o dato trabaja]. El funcionamiento: el usuario sube [tipo de archivo], la inteligencia artificial lo procesa y [qué detecta o genera exactamente], y la web se lo muestra de forma clara para que el usuario pueda revisarlo y ajustarlo antes de descargar el resultado final. El público objetivo son [quién lo usaría y por qué le resuelve un problema real que hoy hace a mano].

Móntalo como un SaaS de suscripción con cuentas y créditos: un plan gratuito con unos pocos créditos para probarlo, y uno o dos planes de pago con más créditos al mes, siendo un crédito lo que consume cada uso. Los pagos que sean de maqueta por ahora, bien señalizados para que se vea que no se cobra nada de verdad, pero que todo lo demás funcione en serio: registro, inicio de sesión, contador de créditos que baje al usar la herramienta, aviso de que te quedas sin créditos y simulación de la mejora de plan. Cuando termines, créame una cuenta de prueba y dime cómo entrar para probarlo yo todo de principio a fin.

Hazme también la página de inicio explicando el producto, con la sección de precios y las páginas legales básicas. Diseño profesional y sobrio. Publícalo en mi hosting cuando esté listo y pásame el enlace.`,
};

/* Capa 3 (DESACTIVADA por ahora en generar.js — ver el comentario allí): redactaría la
   caja "Prompt para usar esta skill" con IA como tercera llamada. Se deja aquí lista
   para reactivarse si en el futuro esto se mueve a una arquitectura que aguante una
   llamada más (background function). */
export function systemPromptDeUso(plantillaId) {
  const ejemplo = PLANTILLA_REFERENCIA[plantillaId];
  if (!ejemplo) return null;
  return `Eres un asistente que redacta la primera petición que un usuario pegará a una skill de Claude Code especializada en construir un tipo concreto de proyecto web. Aquí tienes un ejemplo real de cómo OTRO usuario, con un proyecto totalmente distinto, describió su petición a esa misma skill — es solo una referencia de estructura, extensión y nivel de detalle; NUNCA copies su nicho, sus datos, sus cifras ni ninguna frase literal de él:

"""
${ejemplo}
"""

Ahora, a partir del nombre de la skill y de las secciones ya organizadas que te paso a continuación (que describen la idea real y distinta de este usuario), redacta un prompt nuevo y completamente personalizado, con ese mismo nivel de detalle y esa misma estructura por párrafos, listo para pegarse tal cual como primera petición a esa skill de Claude Code. Termina siempre con una frase indicando que, si no tiene la skill instalada todavía, instale primero el SKILL.md adjunto. Responde SOLO con el texto final del prompt, sin explicaciones ni backticks, en el mismo idioma de las secciones.`;
}
