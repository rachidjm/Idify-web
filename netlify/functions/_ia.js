import { llamarClaude } from './_claude.js';
import { llamarGemini } from './_gemini.js';

/* Claude por defecto, Gemini como alternativa automática — cualquiera de las
   dos claves basta para que el producto funcione (05-gemini-api.md §3b). */
export async function llamarIA(system, prompt, opts = {}) {
  const tieneClaude = !!process.env.ANTHROPIC_API_KEY;
  const tieneGemini = !!process.env.GEMINI_API_KEY;

  if (tieneClaude) {
    try {
      return await llamarClaude(system, prompt, opts.maxTokens);
    } catch (e) {
      console.warn('Claude falló, probando con Gemini si hay clave:', e.message);
    }
  }
  if (tieneGemini) {
    return await llamarGemini(system, prompt, opts);
  }
  throw new Error('no_ia_disponible');
}
