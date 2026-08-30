/* Motor alternativo — capa gratis disponible. Ver reference/05-gemini-api.md:
   camina la lista de modelos hasta que uno responda; nunca thinkingConfig. */
const MODELS = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];

export async function llamarGemini(system, prompt, { json = false, maxTokens = 2000 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('gemini_no_key');

  const generationConfig = { temperature: 0.3, topP: 0.9, maxOutputTokens: maxTokens };
  if (json) generationConfig.responseMimeType = 'application/json';

  const payload = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  let lastErr = '';
  for (const model of MODELS) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) },
      );
      if (!resp.ok) {
        lastErr = `${model} http ${resp.status}`;
        continue;
      }
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) return text.trim();
      const block = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'desconocido';
      lastErr = `${model} respuesta vacía (${block})`;
    } catch (e) {
      lastErr = `${model} ${e.message}`;
    }
  }
  console.error('Gemini call failed:', lastErr);
  throw new Error('gemini_call_failed');
}
