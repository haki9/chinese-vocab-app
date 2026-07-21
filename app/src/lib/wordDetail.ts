import { db } from '../db/db';
import type { Word, WordDetail } from '../db/types';
import type { Lang } from './lang';
import { requestWordDetail } from './wordDetailClient';

/** Lấy chi tiết từ đã cache (IndexedDB) — nếu chưa có, gọi AI sinh 1 lần rồi lưu lại. */
export async function getOrFetchWordDetail(word: Word, lang: Lang): Promise<WordDetail> {
  const cached = await db.wordDetails.get(word.id);
  if (cached) return cached;

  const { note, combos, sentences } = await requestWordDetail(
    { hanzi: word.hanzi, pinyin: word.pinyin, meaning: word.meaning },
    lang,
  );
  const detail: WordDetail = { wordId: word.id, note, combos, sentences, updatedAt: Date.now() };
  await db.wordDetails.put(detail);
  return detail;
}
