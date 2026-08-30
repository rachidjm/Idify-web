const MODEL = 'claude-haiku-4-5-20251001';

export async function llamarClaude(system, prompt, maxTokens = 2000) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error('Claude API error', resp.status, errText);
    throw new Error('claude_call_failed');
  }

  const data = await resp.json();
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
