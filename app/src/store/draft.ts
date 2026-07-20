import { create } from 'zustand';
import type { Lesson, OcrWord } from '../db/types';
import type { Lang } from '../lib/lang';

export interface DraftWord extends OcrWord {
  key: string;
  touched?: boolean; // đã sửa tay → hết cảnh báo
}

interface DraftState {
  source: Lesson['source'];
  lang: Lang;
  pages: string[];       // base64 jpeg (không prefix) — để xem lại ảnh gốc
  words: DraftWord[];
  setDraft: (words: OcrWord[], source: Lesson['source'], lang?: Lang, pages?: string[]) => void;
  setLang: (lang: Lang) => void;
  updateWord: (key: string, patch: Partial<DraftWord>) => void;
  removeWord: (key: string) => void;
  addWord: () => void;
  clear: () => void;
}

let seq = 0;
const k = () => `w${++seq}`;

export const useDraft = create<DraftState>((set) => ({
  source: 'manual',
  lang: 'zh',
  pages: [],
  words: [],
  setDraft: (words, source, lang = 'zh', pages = []) =>
    set({ source, lang, pages, words: words.map((w) => ({ ...w, key: k() })) }),
  setLang: (lang) => set({ lang }),
  updateWord: (key, patch) =>
    set((s) => ({
      words: s.words.map((w) => (w.key === key ? { ...w, ...patch, touched: true } : w)),
    })),
  removeWord: (key) => set((s) => ({ words: s.words.filter((w) => w.key !== key) })),
  addWord: () =>
    set((s) => ({
      words: [...s.words, { key: k(), hanzi: '', pinyin: '', meaning: '', confidence: 1, touched: true }],
    })),
  clear: () => set({ source: 'manual', lang: 'zh', pages: [], words: [] }),
}));

export const CONFIDENCE_THRESHOLD = 0.8;
