import type { Lang } from './lang';

const BCP47: Record<Lang, string> = { zh: 'zh-CN', ja: 'ja-JP' };

const voices: Partial<Record<Lang, SpeechSynthesisVoice | null>> = {};
let checked = false;

function pickVoices() {
  const list = window.speechSynthesis?.getVoices() ?? [];
  voices.zh =
    list.find((v) => v.lang === 'zh-CN') ??
    list.find((v) => v.lang?.toLowerCase().startsWith('zh')) ??
    null;
  voices.ja =
    list.find((v) => v.lang === 'ja-JP') ??
    list.find((v) => v.lang?.toLowerCase().startsWith('ja')) ??
    null;
  checked = true;
}

export function initTts() {
  if (!('speechSynthesis' in window)) { checked = true; return; }
  pickVoices();
  // Chrome load voices bất đồng bộ
  window.speechSynthesis.onvoiceschanged = pickVoices;
}

export function ttsAvailable(lang: Lang = 'zh'): boolean {
  if (!checked) initTts();
  return !!voices[lang];
}

export function speak(text: string, rate = 0.9, lang: Lang = 'zh') {
  if (!ttsAvailable(lang) || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voices[lang]!;
  u.lang = BCP47[lang];
  u.rate = rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
