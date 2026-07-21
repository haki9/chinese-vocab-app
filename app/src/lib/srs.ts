import { nanoid } from 'nanoid';
import { db } from '../db/db';
import type { PracticeMode, Skill, SkillState, Word } from '../db/types';
import { MODE_SKILL } from '../db/types';

const DAY = 24 * 60 * 60 * 1000;
/** Interval (ngày) coi như đã thuộc hẳn 1 kỹ năng */
const MASTERY_DAYS = 21;

export function skillStateId(wordId: string, skill: Skill) {
  return `${wordId}:${skill}`;
}

export function newSkillState(wordId: string, skill: Skill): SkillState {
  return {
    id: skillStateId(wordId, skill),
    wordId, skill,
    easiness: 2.5, repetitions: 0, intervalDays: 0,
    dueAt: Date.now(), // từ mới: đến hạn ngay
    correctCount: 0, wrongCount: 0,
    lastReviewedAt: null, updatedAt: Date.now(),
  };
}

export async function ensureSkillStates(wordIds: string[]) {
  const skills: Skill[] = ['recognize', 'pinyin', 'write'];
  const rows: SkillState[] = [];
  for (const wordId of wordIds) {
    for (const skill of skills) {
      rows.push(newSkillState(wordId, skill));
    }
  }
  // bulkPut sẽ ghi đè — chỉ thêm bản ghi chưa tồn tại
  const existing = new Set(
    (await db.skillStates.bulkGet(rows.map((r) => r.id))).filter(Boolean).map((r) => r!.id),
  );
  await db.skillStates.bulkPut(rows.filter((r) => !existing.has(r.id)));
}

/**
 * SM-2 đơn giản. quality: 5 = đúng ngay, 3 = đúng sau khi sai/lật thẻ, 1 = sai.
 */
export function applySm2(s: SkillState, quality: number, now = Date.now()): SkillState {
  const ef = Math.max(1.3, s.easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  let repetitions: number;
  let intervalDays: number;
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 0; // ôn lại trong ngày/phiên
  } else {
    repetitions = s.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(s.intervalDays * ef);
  }
  return {
    ...s,
    easiness: ef,
    repetitions,
    intervalDays,
    dueAt: now + intervalDays * DAY,
    correctCount: s.correctCount + (quality >= 3 ? 1 : 0),
    wrongCount: s.wrongCount + (quality < 3 ? 1 : 0),
    lastReviewedAt: now,
    updatedAt: now,
  };
}

/** Ghi kết quả 1 câu trả lời: cập nhật SRS + log */
export async function recordAnswer(
  wordId: string, mode: PracticeMode, correct: boolean, opts?: { retried?: boolean; skill?: Skill },
) {
  const skill = opts?.skill ?? MODE_SKILL[mode === 'quick' ? 'quiz' : mode];
  const id = skillStateId(wordId, skill);
  const current = (await db.skillStates.get(id)) ?? newSkillState(wordId, skill);
  const quality = correct ? (opts?.retried ? 3 : 5) : 1;
  await db.skillStates.put(applySm2(current, quality));
  await db.reviewLogs.add({ id: nanoid(), wordId, skill, mode, correct, at: Date.now() });
}

/** % thành thạo của 1 skillState (0-100) */
export function stateMastery(s: SkillState | undefined): number {
  if (!s || s.repetitions === 0) return 0;
  return Math.min(100, Math.round((s.intervalDays / MASTERY_DAYS) * 100));
}

/** "hôm nay" / "ngày mai" / "N ngày nữa" — dùng cho dòng "lịch ôn tiếp theo" ở màn chi tiết từ (5b) */
export function formatDueDate(dueAt: number, now = Date.now()): string {
  if (dueAt <= now) return 'hôm nay';
  const days = Math.ceil((dueAt - now) / DAY);
  if (days === 1) return 'ngày mai';
  return `${days} ngày nữa`;
}

export interface LessonMastery {
  recognize: number;
  pinyin: number;
  write: number;
  overall: number;
  dueCount: number; // số (từ×kỹ năng) đến hạn
  weakestSkill: Skill;
}

export async function lessonMastery(wordIds: string[]): Promise<LessonMastery> {
  const now = Date.now();
  const states = await db.skillStates.where('wordId').anyOf(wordIds).toArray();
  const bySkill: Record<Skill, number[]> = { recognize: [], pinyin: [], write: [] };
  let dueCount = 0;
  const byId = new Map(states.map((s) => [s.id, s]));
  for (const wordId of wordIds) {
    for (const skill of ['recognize', 'pinyin', 'write'] as Skill[]) {
      const s = byId.get(skillStateId(wordId, skill));
      bySkill[skill].push(stateMastery(s));
      if (s && s.dueAt <= now && s.repetitions > 0) dueCount++;
    }
  }
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const recognize = avg(bySkill.recognize);
  const pinyin = avg(bySkill.pinyin);
  const write = avg(bySkill.write);
  const skills: [Skill, number][] = [['recognize', recognize], ['pinyin', pinyin], ['write', write]];
  skills.sort((a, b) => a[1] - b[1]);
  return {
    recognize, pinyin, write,
    overall: avg([recognize, pinyin, write]),
    dueCount,
    weakestSkill: skills[0][0],
  };
}

export type WordStatus = 'new' | 'due' | 'known';

/** Trạng thái nhận mặt chữ (skill 'recognize') từng từ — dùng cho chấm dot màu ở màn Từ vựng (5a) */
export async function recognizeStatuses(
  wordIds: string[],
): Promise<Map<string, { status: WordStatus; wrongCount: number }>> {
  const now = Date.now();
  const states = await db.skillStates.bulkGet(wordIds.map((id) => skillStateId(id, 'recognize')));
  const map = new Map<string, { status: WordStatus; wrongCount: number }>();
  wordIds.forEach((wordId, i) => {
    const s = states[i];
    const wrongCount = s?.wrongCount ?? 0;
    if (!s || s.repetitions === 0) map.set(wordId, { status: 'new', wrongCount });
    else if (s.dueAt <= now) map.set(wordId, { status: 'due', wrongCount });
    else map.set(wordId, { status: 'known', wrongCount });
  });
  return map;
}

/** Đếm từ đến hạn ôn toàn app, gom theo bài */
export async function dueToday(): Promise<{ total: number; byLesson: Map<string, number> }> {
  const now = Date.now();
  const due = await db.skillStates.where('dueAt').belowOrEqual(now).toArray();
  const started = due.filter((s) => s.repetitions > 0);
  const wordIds = [...new Set(started.map((s) => s.wordId))];
  const words = (await db.words.bulkGet(wordIds)).filter(Boolean) as Word[];
  const lessonOf = new Map(words.map((w) => [w.id, w.lessonId]));
  const byLesson = new Map<string, number>();
  const seen = new Set<string>();
  for (const s of started) {
    if (seen.has(s.wordId)) continue; // đếm theo từ, không theo kỹ năng
    seen.add(s.wordId);
    const lid = lessonOf.get(s.wordId);
    if (lid) byLesson.set(lid, (byLesson.get(lid) ?? 0) + 1);
  }
  return { total: seen.size, byLesson };
}

/**
 * Chọn từ cho phiên "Luyện nhanh" / "Ôn hôm nay": ưu tiên quá hạn lâu + hay sai.
 */
export async function pickWeakWords(wordIds: string[], count: number): Promise<string[]> {
  const now = Date.now();
  const states = await db.skillStates.where('wordId').anyOf(wordIds).toArray();
  const scoreByWord = new Map<string, number>();
  for (const s of states) {
    const overdue = Math.max(0, (now - s.dueAt) / DAY);
    const score = s.wrongCount * 3 + overdue - stateMastery(s) / 25;
    scoreByWord.set(s.wordId, (scoreByWord.get(s.wordId) ?? 0) + score);
  }
  const ranked = [...wordIds].sort(
    (a, b) => (scoreByWord.get(b) ?? 0) - (scoreByWord.get(a) ?? 0),
  );
  return ranked.slice(0, count);
}
