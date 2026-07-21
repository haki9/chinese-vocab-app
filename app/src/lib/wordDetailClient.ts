import type { Phrase } from '../db/types';
import type { Lang } from './lang';

/** Cùng origin worker với OCR — suy ra từ VITE_OCR_URL (.../api/ocr -> .../api/word-detail) */
const OCR_URL: string = import.meta.env.VITE_OCR_URL ?? 'http://localhost:8787/api/ocr';
export const WORD_DETAIL_URL: string = OCR_URL.replace(/\/api\/ocr$/, '/api/word-detail');

export class WordDetailError extends Error {
  constructor(public kind: 'network' | 'quota' | 'disabled' | 'server', message: string) {
    super(message);
  }
}

export interface WordDetailResult {
  note: string;
  combos: Phrase[];
  sentences: Phrase[];
}

export async function requestWordDetail(
  word: { hanzi: string; pinyin: string; meaning: string },
  lang: Lang,
): Promise<WordDetailResult> {
  let res: Response;
  try {
    res = await fetch(WORD_DETAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hanzi: word.hanzi, reading: word.pinyin, meaning: word.meaning, lang }),
    });
  } catch {
    throw new WordDetailError('network', 'Không kết nối được máy chủ.');
  }
  if (res.status === 429) throw new WordDetailError('quota', 'Hết lượt xem chi tiết hôm nay, thử lại sau nhé.');
  if (res.status === 503) throw new WordDetailError('disabled', 'Tính năng này đang tạm tắt bảo trì.');
  if (!res.ok) throw new WordDetailError('server', 'Máy chủ gặp lỗi. Thử lại sau ít phút.');

  const data = (await res.json()) as WordDetailResult;
  return { note: data.note ?? '', combos: data.combos ?? [], sentences: data.sentences ?? [] };
}
