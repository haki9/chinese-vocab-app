import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  RATE_KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
  TURNSTILE_SECRET?: string;
  ALLOWED_ORIGIN: string;
  IP_DAILY_LIMIT: string;
  GLOBAL_DAILY_LIMIT: string;
  OCR_DISABLED: string;
  WORD_DETAIL_IP_DAILY_LIMIT: string;
  WORD_DETAIL_GLOBAL_DAILY_LIMIT: string;
  WORD_DETAIL_DISABLED: string;
}

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 1_500_000; // ~1.5MB base64 mỗi ảnh (đã nén client-side)

const PROMPT_OCR = `Ảnh đính kèm là trang vở của một người Việt tự học ngoại ngữ (tiếng Trung hoặc tiếng Nhật), ghi bảng từ vựng viết tay.
Mỗi dòng thường gồm: chữ Hán/Kanji (+ kana nếu là tiếng Nhật), cách đọc (pinyin có dấu thanh, hoặc romaji), và nghĩa tiếng Việt.

BƯỚC 1 — Kiểm tra ngôn ngữ: Trước khi trích xuất, xác định trang ghi từ vựng ngôn ngữ nào.
- Nếu trang ghi từ vựng TIẾNG TRUNG (chữ Hán giản/phồn thể, pinyin) → "language": "zh".
- Nếu trang ghi từ vựng TIẾNG NHẬT (kanji, hiragana/katakana, romaji hoặc furigana) → "language": "ja".
- Nếu trang KHÔNG phải hai ngôn ngữ trên — ví dụ: tiếng Hàn (chữ Hangul), chỉ có tiếng Anh/Việt, bài tập môn khác, trang trắng, hoặc ảnh không phải trang vở — đặt "language": "other", "words": [], và "note" mô tả ngắn gọn bằng tiếng Việt bạn thấy gì (ví dụ: "Trang ghi bằng tiếng Hàn, có chữ Hangul" hoặc "Đây là bài tập toán, không có từ vựng").
- Nếu là "zh" hoặc "ja", đặt "note": "", rồi tiếp tục BƯỚC 2.

BƯỚC 2 — Trích xuất (chỉ khi language = "zh" hoặc "ja"): Trích xuất TẤT CẢ các từ vựng đọc được, theo đúng thứ tự trên trang. Nếu có nhiều ảnh, gộp tất cả thành một danh sách liên tục.

Quy tắc:
- "hanzi": chữ viết gốc — chữ Hán (tiếng Trung) hoặc kanji/kana đúng như người viết (tiếng Nhật).
- "pinyin": nếu language="zh" → pinyin CÓ dấu thanh (ví dụ "míngtiān"), tự suy ra từ chữ Hán nếu trang không ghi. Nếu language="ja" → romaji (ví dụ "konnichiwa"), tự suy ra cách đọc nếu trang không ghi.
- "meaning": nghĩa tiếng Việt đúng chính tả, có dấu. Nếu trang không ghi nghĩa, dịch ngắn gọn sang tiếng Việt.
- "confidence": 0-1, mức chắc chắn bạn đọc đúng CẢ dòng đó (chữ mờ, nét khó đọc, gạch xóa gần kề → giảm confidence).
- BỎ QUA các dòng bị gạch xóa hoàn toàn, tiêu đề bài, số trang, hình vẽ.
- Không bịa thêm từ không có trên trang.
- Không trộn lẫn hai ngôn ngữ trong cùng 1 kết quả — cả trang chỉ thuộc 1 "language" duy nhất (dùng ngôn ngữ chiếm đa số nếu trang có lẫn vài từ ngôn ngữ khác).`;

const OCR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['words', 'language', 'note'],
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
    language: { type: 'string', enum: ['zh', 'ja', 'other'] },
    note: { type: 'string' },
  },
} as const;

const PHRASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'reading', 'meaning'],
  properties: {
    text: { type: 'string' },
    reading: { type: 'string' },
    meaning: { type: 'string' },
  },
} as const;

const WORD_DETAIL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['note', 'combos', 'sentences'],
  properties: {
    note: { type: 'string' },
    combos: { type: 'array', items: PHRASE_SCHEMA },
    sentences: { type: 'array', items: PHRASE_SCHEMA },
  },
} as const;

function wordDetailPrompt(lang: 'zh' | 'ja', hanzi: string, reading: string, meaning: string): string {
  const langName = lang === 'ja' ? 'tiếng Nhật' : 'tiếng Trung';
  const readingLabel = lang === 'ja' ? 'romaji' : 'pinyin có dấu thanh';
  return `Người Việt đang tự học ${langName}, xem chi tiết một từ đã học: "${hanzi}" (${reading}) — nghĩa: ${meaning}.

Hãy sinh nội dung hỗ trợ học từ này gồm:
1. "note": 1 câu ngắn tiếng Việt mô tả từ loại/cách dùng (ví dụ: "Liên từ · dùng đầu câu để chuyển ý"). Nếu không rõ từ loại, để chuỗi rỗng.
2. "combos": 3-5 cụm từ/từ ghép THẬT SỰ thông dụng có chứa "${hanzi}" (hoặc chia sẻ 1 chữ/kanji với nó), mỗi cụm gồm text (chữ gốc), reading (${readingLabel}), meaning (nghĩa Việt ngắn gọn).
3. "sentences": đúng 10 câu ví dụ tự nhiên, đa dạng ngữ cảnh, có dùng "${hanzi}", mỗi câu gồm text (câu gốc bằng ${langName}), reading (${readingLabel} cho CẢ câu), meaning (dịch tiếng Việt tự nhiên).

Chỉ dùng nội dung có thật, tự nhiên, đúng ngữ pháp — không bịa cụm từ/câu gượng ép.`;
}

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

async function handleOcr(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (env.OCR_DISABLED === 'true') {
    return json({ error: 'disabled' }, 503, cors);
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
      return json({ error: 'refused', words: [], language: 'zh', note: '' }, 200, cors);
    }

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json({ words: [], language: 'zh', note: '' }, 200, cors);

    const parsed = JSON.parse(text.text) as {
      words: { hanzi: string; pinyin: string; meaning: string; confidence: number }[];
      language?: 'zh' | 'ja' | 'other';
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
    const language = parsed.language === 'ja' || parsed.language === 'other' ? parsed.language : 'zh';
    const note = String(parsed.note ?? '').trim();

    return json({ words, language, note }, 200, cors);
  } catch (e) {
    console.error('anthropic error', e instanceof Error ? e.message : e);
    return json({ error: 'upstream' }, 502, cors);
  }
}

/**
 * Sinh "từ ghép hay dùng" + "mẫu câu" cho 1 từ (màn chi tiết 5b), cache client-side theo wordId.
 * Không yêu cầu Turnstile (không có widget ở màn luyện tập) — chỉ dựa vào CORS allowlist +
 * rate limit KV riêng (hạn mức thấp hơn OCR nhưng vẫn đủ chặn lạm dụng cơ bản).
 */
async function handleWordDetail(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (env.WORD_DETAIL_DISABLED === 'true') {
    return json({ error: 'disabled' }, 503, cors);
  }

  let body: { hanzi?: string; reading?: string; meaning?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400, cors);
  }

  const hanzi = String(body.hanzi ?? '').trim().slice(0, 40);
  const reading = String(body.reading ?? '').trim().slice(0, 80);
  const meaning = String(body.meaning ?? '').trim().slice(0, 200);
  const lang = body.lang === 'ja' ? 'ja' : 'zh';
  if (!hanzi) return json({ error: 'bad_request' }, 400, cors);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ipLimit = parseInt(env.WORD_DETAIL_IP_DAILY_LIMIT || '60', 10);
  const globalLimit = parseInt(env.WORD_DETAIL_GLOBAL_DAILY_LIMIT || '2000', 10);
  if (!(await bumpQuota(env, `wd:ip:${ip}`, ipLimit)) || !(await bumpQuota(env, 'wd:global', globalLimit))) {
    return json({ error: 'rate_limited' }, 429, cors);
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: WORD_DETAIL_SCHEMA } },
      messages: [{ role: 'user', content: wordDetailPrompt(lang, hanzi, reading, meaning) }],
    });

    if (response.stop_reason === 'refusal') {
      return json({ error: 'refused', note: '', combos: [], sentences: [] }, 200, cors);
    }

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json({ note: '', combos: [], sentences: [] }, 200, cors);

    const parsed = JSON.parse(text.text) as {
      note?: string;
      combos?: { text: string; reading: string; meaning: string }[];
      sentences?: { text: string; reading: string; meaning: string }[];
    };
    const clean = (arr?: { text: string; reading: string; meaning: string }[]) =>
      (arr ?? [])
        .filter((p) => p.text?.trim())
        .map((p) => ({
          text: String(p.text).trim(),
          reading: String(p.reading ?? '').trim(),
          meaning: String(p.meaning ?? '').trim(),
        }));

    return json({
      note: String(parsed.note ?? '').trim(),
      combos: clean(parsed.combos),
      sentences: clean(parsed.sentences),
    }, 200, cors);
  } catch (e) {
    console.error('anthropic error', e instanceof Error ? e.message : e);
    return json({ error: 'upstream' }, 502, cors);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'POST' || (url.pathname !== '/api/ocr' && url.pathname !== '/api/word-detail')) {
      return json({ error: 'not_found' }, 404, cors);
    }

    // Chặn origin lạ (trình duyệt); request không kèm Origin (script) vẫn bị rate limit chặn
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: 'forbidden' }, 403, cors);
    }

    if (url.pathname === '/api/ocr') return handleOcr(request, env, cors);
    return handleWordDetail(request, env, cors);
  },
};
