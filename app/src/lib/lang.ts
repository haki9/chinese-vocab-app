export type Lang = 'zh' | 'ja';

/** Hiragana/Katakana — có mặt thì chắc chắn là tiếng Nhật (chữ Hán/kanji đơn thuần thì không đủ để phân biệt) */
export const HIRAGANA_KATAKANA = /[぀-ヿ]/;
/** Hangul — dùng để chặn tiếng Hàn (chưa hỗ trợ) */
export const HANGUL = /[가-힣]/;

/** Đoán ngôn ngữ từ văn bản dán tay: có kana → tiếng Nhật, ngược lại mặc định tiếng Trung */
export function detectPastedLang(text: string): Lang {
  return HIRAGANA_KATAKANA.test(text) ? 'ja' : 'zh';
}

export const LANG_NAME: Record<Lang, string> = { zh: 'Tiếng Trung', ja: 'Tiếng Nhật' };
export const LANG_FLAG: Record<Lang, string> = { zh: '🇨🇳', ja: '🇯🇵' };
