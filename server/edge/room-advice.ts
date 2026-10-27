/**
 * Edge function: room advice via OpenRouter free vision models (design §4.4).
 * Deployable as a Cloudflare Worker (free tier) or adapted to Vercel/Netlify.
 *
 * Why an edge function: the API key never reaches the browser, the model list
 * can rotate without a site deploy (free models change often), and a hard
 * timeout keeps the visualizer snappy when the free tier is rate-limited
 * (20 req/min; 50 req/day, or 1,000/day once $10 of credits were ever bought).
 *
 * Environment:
 *   OPENROUTER_API_KEY   required
 *   MODELS               comma list, first is tried first (default below)
 *   ALLOWED_ORIGIN       e.g. https://coolplan.example (CORS); "*" for testing
 *
 * Request  (POST JSON): { image: "data:image/jpeg;base64,…" (≤ 512 px), products: [{id,name,nameTh,tone}], locale: "th" }
 * Response (JSON):      { roomType, style, lighting, suggestions: [{ id, reason }], model }
 *
 * Privacy: the image is forwarded to the model provider chosen by OpenRouter.
 * Free endpoints may log or train on inputs (Gemma 4 free routes to Google AI
 * Studio's unpaid tier). The site asks for consent before calling this.
 */
export interface Env { OPENROUTER_API_KEY: string; MODELS?: string; ALLOWED_ORIGIN?: string }

const DEFAULT_MODELS = ['google/gemma-4-26b-a4b-it:free', 'nvidia/nemotron-3.5-super-vl:free', 'google/gemma-4-31b-it:free'];
const TIMEOUT_MS = 9000;

const cors = (env: Env): Record<string, string> => ({
  'access-control-allow-origin': env.ALLOWED_ORIGIN ?? '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'content-type': 'application/json; charset=utf-8',
});

const json = (body: unknown, env: Env, status = 200): Response => new Response(JSON.stringify(body), { status, headers: cors(env) });

function prompt(products: { id: string; name: string; nameTh: string; tone: string }[]): string {
  const list = products.map(p => `- ${p.id}: ${p.name} (${p.nameTh}, โทน${p.tone})`).join('\n');
  return [
    'You are an interior flooring advisor for COOLPLAN SPC vinyl plank flooring in Thailand.',
    'Look at the room photo and answer in JSON only, no prose, with keys:',
    'roomType (Thai, e.g. "ห้องนั่งเล่น"), style (Thai, short), lighting (Thai, short: ทิศทาง/ความสว่างของแสง),',
    'suggestions: array of up to 3 objects {id, reason} choosing ONLY ids from this catalogue, reason in Thai (≤ 20 words), best first.',
    'Consider wall colour, furniture wood tones, brightness and room size. Catalogue:',
    list,
  ].join('\n');
}

async function ask(model: string, image: string, products: { id: string; name: string; nameTh: string; tone: string }[], env: Env): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        'http-referer': env.ALLOWED_ORIGIN ?? 'https://coolplan.local',
        'x-title': 'COOLPLAN floor visualizer',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: .2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt(products) }, { type: 'image_url', image_url: { url: image } }] }],
      }),
    });
    if (!response.ok) throw new Error(`${model}: HTTP ${response.status}`);
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`${model}: no JSON in reply`);
    return { ...JSON.parse(match[0]), model };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    if (request.method !== 'POST') return json({ error: 'POST only' }, env, 405);
    if (!env.OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY not configured' }, env, 503);
    let body: { image?: string; products?: { id: string; name: string; nameTh: string; tone: string }[] };
    try { body = await request.json(); } catch { return json({ error: 'invalid JSON' }, env, 400); }
    if (!body.image?.startsWith('data:image/') || body.image.length > 1_200_000) return json({ error: 'image must be a data URL under ~900 KB' }, env, 400);
    const products = Array.isArray(body.products) ? body.products.slice(0, 24) : [];
    if (!products.length) return json({ error: 'products required' }, env, 400);
    const models = (env.MODELS ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const errors: string[] = [];
    for (const model of models.length ? models : DEFAULT_MODELS) {
      try {
        const answer = await ask(model, body.image, products, env);
        return json(answer, env);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    return json({ error: 'all models failed', details: errors }, env, 502);
  },
};
