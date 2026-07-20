import type { OcrWord } from '../db/types';

/** URL worker — cấu hình khi deploy (VITE_OCR_URL trong .env.production) */
export const OCR_URL: string = import.meta.env.VITE_OCR_URL ?? 'http://localhost:8787/api/ocr';
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

export class OcrError extends Error {
  constructor(
    public kind: 'network' | 'quota' | 'disabled' | 'server' | 'empty' | 'not_chinese',
    message: string,
  ) {
    super(message);
  }
}

/** Nhận diện ký tự Nhật/Hàn trong kết quả — lớp kiểm tra dự phòng, độc lập với cờ is_chinese của AI */
const HIRAGANA_KATAKANA = /[぀-ヿ]/;
const HANGUL = /[가-힣]/;

function detectForeignScript(words: OcrWord[]): string | null {
  const combined = words.map((w) => w.hanzi + w.meaning).join('');
  if (HIRAGANA_KATAKANA.test(combined)) return 'tiếng Nhật (có chữ hiragana/katakana)';
  if (HANGUL.test(combined)) return 'tiếng Hàn (chữ Hangul)';
  return null;
}

export async function requestOcr(imagesBase64: string[], turnstileToken: string): Promise<OcrWord[]> {
  let res: Response;
  try {
    res = await fetch(OCR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: imagesBase64, turnstileToken }),
    });
  } catch {
    throw new OcrError('network', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại, hoặc dùng "Dán văn bản".');
  }
  if (res.status === 429) {
    throw new OcrError('quota', 'Hết lượt quét hôm nay. Bạn có thể dùng "Dán văn bản" hoặc "Nhập tay", mai quét tiếp nhé!');
  }
  if (res.status === 503) {
    throw new OcrError('disabled', 'Tính năng quét đang tạm tắt bảo trì. Dùng "Dán văn bản" hoặc "Nhập tay" nhé.');
  }
  if (!res.ok) {
    throw new OcrError('server', 'Máy chủ gặp lỗi. Thử lại sau ít phút.');
  }
  const data = (await res.json()) as { words: OcrWord[]; isChinese?: boolean; note?: string };

  if (data.isChinese === false) {
    throw new OcrError(
      'not_chinese',
      data.note
        ? `Ảnh này có vẻ không phải từ vựng tiếng Trung — ${data.note}. Hãy chụp trang vở ghi từ vựng tiếng Trung (chữ Hán) nhé.`
        : 'Ảnh này có vẻ không phải nội dung tiếng Trung. Hãy chụp trang vở ghi từ vựng tiếng Trung (chữ Hán) nhé.',
    );
  }
  if (!data.words?.length) {
    throw new OcrError('empty', 'Không đọc được từ nào — ảnh có thể bị mờ hoặc thiếu sáng. Chụp lại gần hơn, đủ sáng nhé.');
  }
  const foreign = detectForeignScript(data.words);
  if (foreign) {
    throw new OcrError('not_chinese', `Ảnh này có vẻ là ${foreign}, không phải tiếng Trung. Hãy chụp trang vở ghi từ vựng tiếng Trung (chữ Hán) nhé.`);
  }
  return data.words;
}
