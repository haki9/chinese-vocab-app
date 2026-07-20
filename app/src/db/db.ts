import Dexie, { type Table } from 'dexie';
import type { Lesson, Profile, ReviewLog, Settings, SkillState, Word } from './types';

class WigoDB extends Dexie {
  lessons!: Table<Lesson, string>;
  words!: Table<Word, string>;
  skillStates!: Table<SkillState, string>;
  reviewLogs!: Table<ReviewLog, string>;
  profile!: Table<Profile, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('wigo');
    this.version(1).stores({
      lessons: 'id, updatedAt',
      words: 'id, lessonId, updatedAt',
      skillStates: 'id, wordId, dueAt, [wordId+skill]',
      reviewLogs: 'id, at, wordId',
      profile: 'id',
      settings: 'id',
    });
  }
}

export const db = new WigoDB();

const defaultProfile = (): Profile => ({
  id: 'me', xp: 0, streakCurrent: 0, streakBest: 0,
  lastActiveDate: '', activeDates: [], badges: [], updatedAt: Date.now(),
});

const defaultSettings = (): Settings => ({
  id: 'app', soundOn: true, ttsRate: 0.9, updatedAt: Date.now(),
});

/** Đọc thuần — an toàn trong useLiveQuery (không được ghi DB trong liveQuery) */
export async function readProfile(): Promise<Profile> {
  return (await db.profile.get('me')) ?? defaultProfile();
}

export async function readSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? defaultSettings();
}

/** Seed bản ghi mặc định lúc khởi động app (ngoài liveQuery) */
export async function initDefaults() {
  if (!(await db.profile.get('me'))) await db.profile.put(defaultProfile());
  if (!(await db.settings.get('app'))) await db.settings.put(defaultSettings());
}

/** Dùng ngoài liveQuery (có thể ghi nếu thiếu) */
export async function getProfile(): Promise<Profile> {
  const p = await db.profile.get('me');
  if (p) return p;
  const fresh = defaultProfile();
  await db.profile.put(fresh);
  return fresh;
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app');
  if (s) return s;
  const fresh = defaultSettings();
  await db.settings.put(fresh);
  return fresh;
}

/** Xin trình duyệt giữ dữ liệu lâu dài (chống Safari dọn IndexedDB) */
export function requestPersistentStorage() {
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
