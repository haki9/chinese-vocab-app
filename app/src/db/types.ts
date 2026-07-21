export type Skill = 'recognize' | 'pinyin' | 'write';

export type PracticeMode =
  | 'vocab'      // Từ vựng (xem + nghe)
  | 'flashcard'  // Flashcard
  | 'quiz'       // Trắc nghiệm Hán↔Việt
  | 'typing'     // Gõ pinyin
  | 'match'      // Nối từ
  | 'writing'    // Tập viết
  | 'quick';     // Luyện nhanh 5 phút (trộn)

export const MODE_SKILL: Record<Exclude<PracticeMode, 'quick'>, Skill> = {
  vocab: 'recognize',
  flashcard: 'recognize',
  quiz: 'recognize',
  typing: 'pinyin',
  match: 'recognize',
  writing: 'write',
};

export interface Lesson {
  id: string;
  title: string;
  source: 'ocr' | 'paste' | 'manual';
  /** 'zh' (tiếng Trung) | 'ja' (tiếng Nhật) — bài tạo trước khi có tiếng Nhật sẽ không có field này, coi như 'zh' */
  lang?: 'zh' | 'ja';
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Word {
  id: string;
  lessonId: string;
  hanzi: string;
  /** Với bài tiếng Nhật: romaji (cách đọc), không phải hiragana/katakana */
  pinyin: string;
  meaning: string;
  order: number;
  /** Đánh dấu ở màn Từ vựng (5a) — lọc theo "Đã đánh dấu" */
  starred?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface SkillState {
  id: string; // `${wordId}:${skill}`
  wordId: string;
  skill: Skill;
  easiness: number;      // SM-2 EF, khởi tạo 2.5
  repetitions: number;
  intervalDays: number;
  dueAt: number;         // timestamp
  correctCount: number;
  wrongCount: number;
  lastReviewedAt: number | null;
  updatedAt: number;
}

export interface ReviewLog {
  id: string;
  wordId: string;
  skill: Skill;
  mode: PracticeMode;
  correct: boolean;
  at: number;
}

export interface BadgeEarned {
  badgeId: string;
  earnedAt: number;
}

export interface Profile {
  id: 'me';
  xp: number;
  streakCurrent: number;
  streakBest: number;
  lastActiveDate: string;   // 'YYYY-MM-DD'
  activeDates: string[];    // các ngày có hoạt động (giữ ~60 ngày gần nhất)
  badges: BadgeEarned[];
  updatedAt: number;
}

export interface Settings {
  id: 'app';
  soundOn: boolean;
  ttsRate: number;
  updatedAt: number;
}

/** Kết quả OCR trả về từ worker */
export interface OcrWord {
  hanzi: string;
  pinyin: string;
  meaning: string;
  confidence: number; // 0-1
}

/** Một cụm chữ hoặc câu ví dụ: chữ gốc + cách đọc + nghĩa Việt (dùng chung cho từ ghép lẫn mẫu câu) */
export interface Phrase {
  text: string;
  reading: string;
  meaning: string;
}

/** Nội dung chi tiết 1 từ do AI sinh (màn 5b) — cache theo wordId, chỉ sinh 1 lần/từ/máy */
export interface WordDetail {
  wordId: string;
  note: string;
  combos: Phrase[];
  sentences: Phrase[];
  updatedAt: number;
}
