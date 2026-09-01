const MODEL = 'claude-haiku-4-5-20251001';

/* Netlify mata la función en seco a los 30s SIN loguear nada si algo se cuelga por
   dentro (confirmado: 3 ejecuciones seguidas con Duration exacto de 30000ms y cero
   errores). Un fetch() sin límite propio puede quedarse esperando indefinidamente si
   la API tarda o no responde — este timeout hace que falle con un error claro y
   capturable bastante antes de esos 30s, en vez de dejar que mate la función entera. */
const TIMEOUT_MS = 13000;

export async function llamarClaude(system, prompt, maxTokens = 2000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const inicio = Date.now();

  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // La segunda llamada seguida a la misma API se colgaba sin respuesta — huele a
        // que hereda una conexión keep-alive muerta de la primera. Fuerza una conexión
        // nueva en cada llamada en vez de reutilizar una.
        'connection': 'close',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error(`Claude API timeout tras ${Date.now() - inicio}ms (límite ${TIMEOUT_MS}ms)`);
      throw new Error('claude_call_timeout');
    }
    console.error('Claude API fetch failed', e.message);
    throw new Error('claude_call_failed');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error('Claude API error', resp.status, errText, `(${Date.now() - inicio}ms)`);
    throw new Error('claude_call_failed');
  }

  const data = await resp.json();
  console.log(`Claude API OK en ${Date.now() - inicio}ms`);
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

export function parseJSONSeguro(texto) {
  const limpio = texto.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    // Gemini a veces cierra un array con un `]` duplicado — reintenta
    // recortando desde la primera { hasta la última } (05-gemini-api.md).
    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');
    if (inicio === -1 || fin === -1 || fin <= inicio) throw new Error('json_invalido');
    return JSON.parse(limpio.slice(inicio, fin + 1));
  }
}
