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
