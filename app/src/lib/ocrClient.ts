import type { OcrWord } from '../db/types';

/** URL worker — cấu hình khi deploy (VITE_OCR_URL trong .env.production) */
export const OCR_URL: string = import.meta.env.VITE_OCR_URL ?? 'http://localhost:8787/api/ocr';
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

export class OcrError extends Error {
  constructor(public kind: 'network' | 'quota' | 'disabled' | 'server' | 'empty', message: string) {
    super(message);
  }
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
  const data = (await res.json()) as { words: OcrWord[] };
  if (!data.words?.length) {
    throw new OcrError('empty', 'Không đọc được từ nào — ảnh có thể bị mờ hoặc thiếu sáng. Chụp lại gần hơn, đủ sáng nhé.');
  }
  return data.words;
}
