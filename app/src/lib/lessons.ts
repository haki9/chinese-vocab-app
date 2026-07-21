import { nanoid } from 'nanoid';
import { db } from '../db/db';
import type { Lesson, OcrWord, Word } from '../db/types';
import { detectPastedLang, type Lang } from './lang';
import { ensureSkillStates } from './srs';

/** Chữ Hán/Kanji đầu dòng, hoặc kanji+kana (tiếng Nhật) */
const LEADING_CJK = /^([一-鿿㐀-䶿぀-ヿ，。]+)[\s,;:\-–—\t]*(.*)$/;

/** Parse văn bản dán vào: mỗi dòng `chữ  cách đọc  nghĩa` (cách đọc có thể thiếu → tự sinh gợi ý nếu là tiếng Trung) */
export async function parsePastedText(text: string): Promise<{ words: OcrWord[]; lang: Lang }> {
  const lang = detectPastedLang(text);
  // pinyin-pro nặng (~500KB) — chỉ tải khi thực sự dán văn bản tiếng Trung
  const toPinyin = lang === 'zh' ? (await import('pinyin-pro')).pinyin : null;
  const out: OcrWord[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // tách phần chữ đầu dòng
    const m = line.match(LEADING_CJK);
    if (!m) continue;
    const hanzi = m[1].replace(/[，。]/g, '');
    let rest = m[2].trim();
    // pinyin/romaji = phần chữ latin có dấu đứng trước, nghĩa = phần còn lại
    let pinyin = '';
    let meaning = rest;
    const pm = rest.match(/^([a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ'\s]+?)[\s\-–—:,;\t]+(.+)$/);
    if (pm && !/[àảãạáăâằẳẵặắấầẩẫậđèẻẽẹéêềểễệếìỉĩịíòỏõọóôồổỗộốơờởỡợớùủũụúưừửữựứỳỷỹỵý]/i.test(pm[1])) {
      pinyin = pm[1].trim();
      meaning = pm[2].trim();
    }
    if (!pinyin && hanzi && toPinyin) {
      pinyin = toPinyin(hanzi); // gợi ý tự động (chỉ tiếng Trung) — người dùng duyệt lại
    }
    out.push({ hanzi, pinyin, meaning, confidence: pinyin && meaning ? 1 : 0.5 });
  }
  return { words: out, lang };
}

/** Tạo bài học mới từ danh sách từ đã duyệt */
export async function createLesson(
  title: string,
  words: { hanzi: string; pinyin: string; meaning: string }[],
  source: Lesson['source'],
  lang: Lang = 'zh',
): Promise<string> {
  const now = Date.now();
  const lessonId = nanoid();
  const lesson: Lesson = { id: lessonId, title, source, lang, createdAt: now, updatedAt: now };
  const rows: Word[] = words
    .filter((w) => w.hanzi.trim())
    .map((w, i) => ({
      id: nanoid(),
      lessonId,
      hanzi: w.hanzi.trim(),
      pinyin: w.pinyin.trim(),
      meaning: w.meaning.trim(),
      order: i,
      createdAt: now,
      updatedAt: now,
    }));
  await db.transaction('rw', db.lessons, db.words, db.skillStates, async () => {
    await db.lessons.add(lesson);
    await db.words.bulkAdd(rows);
  });
  await ensureSkillStates(rows.map((r) => r.id));
  return lessonId;
}

export async function nextLessonNumber(): Promise<number> {
  return (await db.lessons.filter((l) => !l.deletedAt).count()) + 1;
}

export async function lessonWords(lessonId: string): Promise<Word[]> {
  const ws = await db.words.where('lessonId').equals(lessonId).toArray();
  return ws.filter((w) => !w.deletedAt).sort((a, b) => a.order - b.order);
}

/** Tách "Bài 7 · 明天你有课吗?" -> ['Bài 7', '明天你有课吗?'] (không có '·' -> ['', title]) */
export function splitLessonTitle(title: string): [string, string] {
  if (!title.includes('·')) return ['', title];
  const [num, ...rest] = title.split('·');
  return [num.trim(), rest.join('·').trim()];
}

export function relativeTime(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  if (days < 7) return `${days} ngày trước`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} tuần trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}
