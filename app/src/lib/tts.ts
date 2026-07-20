let zhVoice: SpeechSynthesisVoice | null = null;
let checked = false;

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  zhVoice =
    voices.find((v) => v.lang === 'zh-CN') ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('zh')) ??
    null;
  checked = true;
}

export function initTts() {
  if (!('speechSynthesis' in window)) { checked = true; return; }
  pickVoice();
  // Chrome load voices bất đồng bộ
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function ttsAvailable(): boolean {
  if (!checked) initTts();
  return zhVoice !== null;
}

export function speak(text: string, rate = 0.9) {
  if (!ttsAvailable() || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = zhVoice;
  u.lang = 'zh-CN';
  u.rate = rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
