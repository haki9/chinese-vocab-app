import type { OcrWord } from '../db/types';
import { HANGUL, type Lang } from './lang';

/** URL worker — cấu hình khi deploy (VITE_OCR_URL trong .env.production) */
export const OCR_URL: string = import.meta.env.VITE_OCR_URL ?? 'http://localhost:8787/api/ocr';
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

export class OcrError extends Error {
  constructor(
    public kind: 'network' | 'quota' | 'disabled' | 'server' | 'empty' | 'not_supported',
    message: string,
  ) {
    super(message);
  }
}

/** Nhận diện Hangul — lớp kiểm tra dự phòng, độc lập với phân loại ngôn ngữ của AI */
function detectUnsupportedScript(words: OcrWord[]): string | null {
  const combined = words.map((w) => w.hanzi + w.meaning).join('');
  if (HANGUL.test(combined)) return 'tiếng Hàn (chữ Hangul)';
  return null;
}

export async function requestOcr(
  imagesBase64: string[],
  turnstileToken: string,
): Promise<{ words: OcrWord[]; lang: Lang }> {
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
  const data = (await res.json()) as { words: OcrWord[]; language?: Lang | 'other'; note?: string };

  if (data.language === 'other') {
    throw new OcrError(
      'not_supported',
      data.note
        ? `Ảnh này có vẻ không phải từ vựng tiếng Trung/tiếng Nhật — ${data.note}. Hãy chụp trang vở ghi từ vựng tiếng Trung hoặc tiếng Nhật nhé.`
        : 'Ảnh này có vẻ không phải nội dung tiếng Trung/tiếng Nhật. Hãy chụp trang vở ghi từ vựng tiếng Trung hoặc tiếng Nhật nhé.',
    );
  }
  if (!data.words?.length) {
    throw new OcrError('empty', 'Không đọc được từ nào — ảnh có thể bị mờ hoặc thiếu sáng. Chụp lại gần hơn, đủ sáng nhé.');
  }
  const unsupported = detectUnsupportedScript(data.words);
  if (unsupported) {
    throw new OcrError('not_supported', `Ảnh này có vẻ là ${unsupported}, chưa được hỗ trợ. Hãy chụp trang vở ghi từ vựng tiếng Trung hoặc tiếng Nhật nhé.`);
  }
  return { words: data.words, lang: data.language === 'ja' ? 'ja' : 'zh' };
}
