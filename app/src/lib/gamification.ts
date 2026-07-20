import { db, getProfile } from '../db/db';
import type { Profile } from '../db/types';

/** ===== XP & cấp độ ===== */
export const XP_CORRECT = 5;
export const XP_STREAK_BONUS = 2;   // mỗi câu khi chuỗi đúng ≥ 5
export const XP_SESSION_DONE = 10;
export const XP_QUICK_SESSION = 25;

export const LEVEL_NAMES = [
  'Người mới', 'Học trò', 'Chăm chỉ', 'Siêng năng', 'Tiến bộ',
  'Vững vàng', 'Học giả nhỏ', 'Học giả', 'Cao thủ', 'Bậc thầy',
];

/** XP cần để LÊN cấp n+1 từ cấp n (lũy tiến) */
export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 200; // cấp 1→2: 100, 2→3: 300, ...
}

export interface LevelInfo {
  level: number;
  name: string;
  xpInLevel: number;
  xpNeeded: number;
  totalXp: number;
}

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return {
    level,
    name: LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)],
    xpInLevel: remaining,
    xpNeeded: xpForLevel(level),
    totalXp,
  };
}

/** ===== Streak ===== */
function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function todayStr() { return dateStr(new Date()); }
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateStr(d);
}

/** Gọi khi có hoạt động học — cập nhật streak + activeDates. Trả về profile mới + có lên cấp không. */
export async function addXpAndTouchStreak(xpGained: number): Promise<{
  profile: Profile; leveledUp: boolean; newLevel: LevelInfo;
}> {
  const p = await getProfile();
  const before = levelFromXp(p.xp);
  const today = todayStr();

  let { streakCurrent, streakBest } = p;
  if (p.lastActiveDate !== today) {
    streakCurrent = p.lastActiveDate === yesterdayStr() ? streakCurrent + 1 : 1;
    streakBest = Math.max(streakBest, streakCurrent);
  }
  const activeDates = [...new Set([...p.activeDates, today])].sort().slice(-60);

  const updated: Profile = {
    ...p,
    xp: p.xp + xpGained,
    streakCurrent, streakBest,
    lastActiveDate: today,
    activeDates,
    updatedAt: Date.now(),
  };
  await db.profile.put(updated);
  const after = levelFromXp(updated.xp);
  return { profile: updated, leveledUp: after.level > before.level, newLevel: after };
}

/** Nếu bỏ lỡ ≥ 1 ngày thì streak hiển thị = 0 (chưa học hôm nay và hôm qua) */
export function displayStreak(p: Profile): number {
  const today = todayStr();
  if (p.lastActiveDate === today || p.lastActiveDate === yesterdayStr()) return p.streakCurrent;
  return 0;
}

/** ===== Huy hiệu ===== */
export interface BadgeDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-lesson', emoji: '📷', title: 'Bài đầu tiên', description: 'Tạo bài học đầu tiên' },
  { id: 'streak-7', emoji: '🔥', title: 'Chuỗi 7 ngày', description: 'Học 7 ngày liên tiếp' },
  { id: 'correct-100', emoji: '💯', title: '100 câu đúng', description: 'Trả lời đúng 100 câu' },
  { id: 'write-50', emoji: '✍️', title: 'Viết 50 chữ', description: 'Tập viết 50 chữ Hán' },
  { id: 'night-owl', emoji: '🌙', title: 'Cú đêm', description: 'Luyện tập sau 23h' },
  { id: 'words-300', emoji: '📖', title: '300 từ thuộc', description: 'Thành thạo 300 từ' },
  { id: 'streak-30', emoji: '🥈', title: 'Chuỗi 30 ngày', description: 'Học 30 ngày liên tiếp' },
  { id: 'hsk1', emoji: '🀄', title: 'Cao thủ HSK1', description: 'Thuộc 150 từ trở lên' },
];

/** Kiểm tra và trao huy hiệu mới. Trả về danh sách huy hiệu vừa đạt. */
export async function checkBadges(): Promise<BadgeDef[]> {
  const p = await getProfile();
  const have = new Set(p.badges.map((b) => b.badgeId));
  const earned: BadgeDef[] = [];

  const award = (id: string) => {
    if (have.has(id)) return;
    const def = BADGES.find((b) => b.id === id);
    if (def) earned.push(def);
  };

  const lessonCount = await db.lessons.filter((l) => !l.deletedAt).count();
  if (lessonCount >= 1) award('first-lesson');

  if (p.streakCurrent >= 7) award('streak-7');
  if (p.streakCurrent >= 30) award('streak-30');

  const correctTotal = await db.reviewLogs.filter((r) => r.correct).count();
  if (correctTotal >= 100) award('correct-100');

  const writeCount = await db.reviewLogs.filter((r) => r.skill === 'write').count();
  if (writeCount >= 50) award('write-50');

  const hour = new Date().getHours();
  if (hour >= 23 || hour < 4) {
    const recentLog = await db.reviewLogs.orderBy('at').last();
    if (recentLog && Date.now() - recentLog.at < 10 * 60 * 1000) award('night-owl');
  }

  // từ "thuộc": repetitions ≥ 2 ở kỹ năng nhận mặt chữ
  const known = await db.skillStates
    .filter((s) => s.skill === 'recognize' && s.repetitions >= 2)
    .count();
  if (known >= 150) award('hsk1');
  if (known >= 300) award('words-300');

  if (earned.length) {
    const now = Date.now();
    await db.profile.put({
      ...p,
      badges: [...p.badges, ...earned.map((b) => ({ badgeId: b.id, earnedAt: now }))],
      updatedAt: now,
    });
  }
  return earned;
}

/** Số từ đã thuộc (hiện trên trang chủ + tiến độ) */
export async function knownWordCount(): Promise<number> {
  return db.skillStates.filter((s) => s.skill === 'recognize' && s.repetitions >= 2).count();
}
