/**
 * Chuẩn hóa pinyin để so khớp KHÔNG cần dấu thanh:
 * - NFD rồi bỏ combining marks (ā→a, ǒ→o…)
 * - ü → u, chấp nhận người dùng gõ v thay ü
 * - bỏ số thanh điệu (ni3 → ni), khoảng trắng, ký tự lạ, lowercase
 */
export function normalizePinyin(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ü/g, 'u')
    .replace(/v/g, 'u')
    .replace(/[0-9]/g, '')
    .replace(/[^a-z]/g, '');
}

export function pinyinMatches(answer: string, userInput: string): boolean {
  const a = normalizePinyin(answer);
  const b = normalizePinyin(userInput);
  return a.length > 0 && a === b;
}

const HANZI_ONLY = /[一-鿿㐀-䶿]/;

/** "Thanh 3 + thanh 4" — chỉ áp dụng tiếng Trung, dựa vào chữ Hán (không suy được từ chuỗi pinyin đã ghép) */
export async function toneBreakdown(hanzi: string): Promise<string> {
  const chars = [...hanzi].filter((c) => HANZI_ONLY.test(c));
  if (!chars.length) return '';
  const { pinyin: toPinyin } = await import('pinyin-pro');
  const syllables = toPinyin(chars.join(''), { toneType: 'num', type: 'array' }) as string[];
  const tones = syllables.map((s) => {
    const m = s.match(/([1-5])$/);
    return m ? (m[1] === '5' ? 'nhẹ' : m[1]) : 'nhẹ';
  });
  return `Thanh ${tones.join(' + thanh ')}`;
}
