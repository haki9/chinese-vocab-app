import { db } from '../db/db';
import { createLesson } from './lessons';

/**
 * Bài demo trích từ ảnh vở thật (Bài 7: 明天你有课吗?) — seed một lần duy nhất.
 */
const DEMO_TITLE = 'Bài 7 · 明天你有课吗?';

const DEMO_WORDS: { hanzi: string; pinyin: string; meaning: string }[] = [
  { hanzi: '前天', pinyin: 'qiántiān', meaning: 'hôm kia' },
  { hanzi: '昨天', pinyin: 'zuótiān', meaning: 'hôm qua' },
  { hanzi: '今天', pinyin: 'jīntiān', meaning: 'hôm nay' },
  { hanzi: '明天', pinyin: 'míngtiān', meaning: 'ngày mai' },
  { hanzi: '后天', pinyin: 'hòutiān', meaning: 'ngày kia' },
  { hanzi: '明天上午', pinyin: 'míngtiān shàngwǔ', meaning: 'sáng mai' },
  { hanzi: '课', pinyin: 'kè', meaning: 'môn học, bài học' },
  { hanzi: '什么课', pinyin: 'shénme kè', meaning: 'môn gì?' },
  { hanzi: '上午', pinyin: 'shàngwǔ', meaning: 'buổi sáng' },
  { hanzi: '下午', pinyin: 'xiàwǔ', meaning: 'buổi chiều' },
  { hanzi: '没有', pinyin: 'méiyǒu', meaning: 'không có' },
  { hanzi: '车', pinyin: 'chē', meaning: 'xe' },
  { hanzi: '自行车', pinyin: 'zìxíngchē', meaning: 'xe đạp' },
  { hanzi: '吧', pinyin: 'ba', meaning: 'nhé, đi, thôi…! / nhỉ? (xác nhận lại thông tin)' },
  { hanzi: '事', pinyin: 'shì', meaning: 'sự việc' },
  { hanzi: '同事', pinyin: 'tóngshì', meaning: 'đồng nghiệp' },
  { hanzi: '可是', pinyin: 'kěshì', meaning: 'nhưng mà' },
  { hanzi: '问题', pinyin: 'wèntí', meaning: 'vấn đề' },
];

const SEED_FLAG = 'wigo-demo-seeded-v1';

export async function seedDemoLesson() {
  if (localStorage.getItem(SEED_FLAG)) return;
  // đã có bài trùng tên (vd khôi phục backup) thì thôi
  const dup = await db.lessons.filter((l) => l.title === DEMO_TITLE && !l.deletedAt).count();
  if (!dup) await createLesson(DEMO_TITLE, DEMO_WORDS, 'ocr');
  localStorage.setItem(SEED_FLAG, '1');
}
