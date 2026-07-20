import confetti from 'canvas-confetti';
import { getSettings } from '../db/db';

/** Âm thanh tổng hợp bằng WebAudio — không cần file mp3, offline được */
let ctx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const ac = audioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.05);
}

async function soundOn(): Promise<boolean> {
  return (await getSettings()).soundOn;
}

export async function playCorrect() {
  if (!(await soundOn())) return;
  tone(660, 0, 0.12); tone(880, 0.1, 0.18);
}

export async function playWrong() {
  if (!(await soundOn())) return;
  tone(330, 0, 0.15, 'triangle'); tone(220, 0.12, 0.25, 'triangle');
}

export async function playLevelUp() {
  if (!(await soundOn())) return;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.2));
}

export async function playSessionDone() {
  if (!(await soundOn())) return;
  [523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.18));
}

export function confettiBurst() {
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
}

export function confettiBig() {
  confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 } });
  setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 } }), 250);
  setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 } }), 400);
}
