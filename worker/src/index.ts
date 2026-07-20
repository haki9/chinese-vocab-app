import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  RATE_KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
  TURNSTILE_SECRET?: string;
  ALLOWED_ORIGIN: string;
  IP_DAILY_LIMIT: string;
  GLOBAL_DAILY_LIMIT: string;
  OCR_DISABLED: string;
}

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 1_500_000; // ~1.5MB base64 mỗi ảnh (đã nén client-side)

const PROMPT_OCR = `Ảnh đính kèm là trang vở của một người Việt tự học tiếng Trung, ghi bảng từ vựng viết tay.
Mỗi dòng thường gồm: chữ Hán (giản thể), pinyin (có dấu thanh), và nghĩa tiếng Việt.

BƯỚC 1 — Kiểm tra ngôn ngữ: Trước khi trích xuất, xác định trang có thực sự ghi từ vựng TIẾNG TRUNG (chữ Hán) hay không.
- Nếu trang KHÔNG phải tiếng Trung — ví dụ: tiếng Nhật (có hiragana/katakana), tiếng Hàn (chữ Hangul), chỉ có tiếng Anh/Việt, bài tập môn khác, trang trắng, hoặc ảnh không phải trang vở — đặt "is_chinese": false, "words": [], và "note" mô tả ngắn gọn bằng tiếng Việt bạn thấy gì (ví dụ: "Trang ghi bằng tiếng Nhật, có chữ hiragana/katakana" hoặc "Đây là bài tập toán, không có từ vựng tiếng Trung").
- Nếu trang đúng là từ vựng tiếng Trung, đặt "is_chinese": true, "note": "", rồi tiếp tục BƯỚC 2.

BƯỚC 2 — Trích xuất (chỉ khi is_chinese = true): Trích xuất TẤT CẢ các từ vựng đọc được, theo đúng thứ tự trên trang. Nếu có nhiều ảnh, gộp tất cả thành một danh sách liên tục.

Quy tắc:
- "hanzi": chữ Hán giản thể. Nếu người viết dùng phồn thể thì giữ nguyên như họ viết.
- "pinyin": pinyin CÓ dấu thanh (ví dụ "míngtiān"). Nếu trang không ghi pinyin, tự suy ra từ chữ Hán.
- "meaning": nghĩa tiếng Việt đúng chính tả, có dấu. Nếu trang không ghi nghĩa, dịch ngắn gọn sang tiếng Việt.
- "confidence": 0-1, mức chắc chắn bạn đọc đúng CẢ dòng đó (chữ mờ, nét khó đọc, gạch xóa gần kề → giảm confidence).
- BỎ QUA các dòng bị gạch xóa hoàn toàn, tiêu đề bài, số trang, hình vẽ.
- Không bịa thêm từ không có trên trang.`;

const OCR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['words', 'is_chinese', 'note'],
  properties: {
    words: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['hanzi', 'pinyin', 'meaning', 'confidence'],
        properties: {
          hanzi: { type: 'string' },
          pinyin: { type: 'string' },
          meaning: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    is_chinese: { type: 'boolean' },
    note: { type: 'string' },
  },
} as const;

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN
    ? env.ALLOWED_ORIGIN
    : origin && /^http:\/\/localhost(:\d+)?$/.test(origin) ? origin : 'http://localhost:5173';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true; // dev: chưa cấu hình → bỏ qua
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  });
  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}

/** Đếm + kiểm tra hạn mức theo ngày trong KV. Trả về true nếu CÒN hạn mức. */
async function bumpQuota(env: Env, key: string, limit: number): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const fullKey = `${key}:${today}`;
  const current = parseInt((await env.RATE_KV.get(fullKey)) ?? '0', 10);
  if (current >= limit) return false;
  await env.RATE_KV.put(fullKey, String(current + 1), { expirationTtl: 90_000 });
  return true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/api/ocr') {
      return json({ error: 'not_found' }, 404, cors);
    }

    if (env.OCR_DISABLED === 'true') {
      return json({ error: 'disabled' }, 503, cors);
    }

    // Chặn origin lạ (trình duyệt); request không kèm Origin (script) vẫn bị Turnstile + rate limit chặn
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: 'forbidden' }, 403, cors);
    }

    let body: { images?: string[]; turnstileToken?: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_request' }, 400, cors);
    }

    const images = (body.images ?? []).slice(0, MAX_IMAGES);
    if (!images.length) return json({ error: 'no_images' }, 400, cors);
    for (const img of images) {
      if (typeof img !== 'string' || img.length > MAX_IMAGE_BYTES) {
        return json({ error: 'image_too_large' }, 400, cors);
      }
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';

    if (!(await verifyTurnstile(env, body.turnstileToken ?? '', ip))) {
      return json({ error: 'turnstile_failed' }, 403, cors);
    }

    const ipLimit = parseInt(env.IP_DAILY_LIMIT || '10', 10);
    const globalLimit = parseInt(env.GLOBAL_DAILY_LIMIT || '300', 10);
    if (!(await bumpQuota(env, `ip:${ip}`, ipLimit)) || !(await bumpQuota(env, 'global', globalLimit))) {
      return json({ error: 'rate_limited' }, 429, cors);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { format: { type: 'json_schema', schema: OCR_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((data) => ({
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data },
              })),
              { type: 'text' as const, text: PROMPT_OCR },
            ],
          },
        ],
      });

      if (response.stop_reason === 'refusal') {
        return json({ error: 'refused', words: [], isChinese: true, note: '' }, 200, cors);
      }

      const text = response.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') return json({ words: [], isChinese: true, note: '' }, 200, cors);

      const parsed = JSON.parse(text.text) as {
        words: { hanzi: string; pinyin: string; meaning: string; confidence: number }[];
        is_chinese?: boolean;
        note?: string;
      };
      const words = (parsed.words ?? [])
        .filter((w) => w.hanzi?.trim())
        .map((w) => ({
          hanzi: String(w.hanzi).trim(),
          pinyin: String(w.pinyin ?? '').trim(),
          meaning: String(w.meaning ?? '').trim(),
          confidence: Math.max(0, Math.min(1, Number(w.confidence) || 0)),
        }));
      const isChinese = parsed.is_chinese !== false;
      const note = String(parsed.note ?? '').trim();

      return json({ words, isChinese, note }, 200, cors);
    } catch (e) {
      console.error('anthropic error', e instanceof Error ? e.message : e);
      return json({ error: 'upstream' }, 502, cors);
    }
  },
};
