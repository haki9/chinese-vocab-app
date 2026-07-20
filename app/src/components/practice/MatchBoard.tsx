import { useEffect, useMemo, useState } from 'react';
import type { Word } from '../../db/types';
import { playCorrect, playWrong } from '../../lib/feedback';
import { speak } from '../../lib/tts';

interface Props {
  words: Word[];
  onWordResult: (wordId: string, correct: boolean) => void;
  onFinished: () => void;
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ROUND_SIZE = 5;

export default function MatchBoard({ words, onWordResult, onFinished }: Props) {
  const rounds = useMemo(() => {
    const shuffled = shuffle(words);
    const out: Word[][] = [];
    for (let i = 0; i < shuffled.length; i += ROUND_SIZE) out.push(shuffled.slice(i, i + ROUND_SIZE));
    return out.filter((r) => r.length >= 2);
  }, [words]);

  const [round, setRound] = useState(0);
  const current = rounds[round] ?? [];

  const [left, setLeft] = useState<Word[]>([]);
  const [right, setRight] = useState<Word[]>([]);
  const [selLeft, setSelLeft] = useState<string | null>(null);
  const [selRight, setSelRight] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [errored, setErrored] = useState<Set<string>>(new Set());
  const [errFlash, setErrFlash] = useState<string[]>([]);

  useEffect(() => {
    setLeft(shuffle(current));
    setRight(shuffle(current));
    setSelLeft(null); setSelRight(null);
    setDone(new Set()); setErrored(new Set()); setErrFlash([]);
  }, [round, rounds]);

  useEffect(() => {
    if (!current.length || done.size !== current.length) return;
    // hết vòng: báo kết quả từng từ
    for (const w of current) onWordResult(w.id, !errored.has(w.id));
    if (round + 1 < rounds.length) setTimeout(() => setRound(round + 1), 500);
    else setTimeout(onFinished, 500);
  }, [done]);

  useEffect(() => {
    if (selLeft === null || selRight === null) return;
    if (selLeft === selRight) {
      playCorrect();
      speak(current.find((w) => w.id === selLeft)?.hanzi ?? '');
      setDone((d) => new Set(d).add(selLeft));
    } else {
      playWrong();
      setErrored((e) => new Set(e).add(selLeft));
      setErrFlash([selLeft, selRight]);
      setTimeout(() => setErrFlash([]), 350);
    }
    setSelLeft(null); setSelRight(null);
  }, [selLeft, selRight]);

  if (!current.length) return null;

  const cellCls = (id: string, side: 'l' | 'r', sel: string | null) => {
    let cls = 'match-cell';
    if (done.has(id)) cls += ' ok';
    else if (errFlash.includes(id) && (side === 'l' ? errFlash[0] === id : errFlash[1] === id)) cls += ' err';
    else if (sel === id) cls += ' sel';
    return cls;
  };

  return (
    <div className="px stack gap-4 grow" style={{ paddingTop: 8 }}>
      <div className="center muted" style={{ fontWeight: 700 }}>
        Nối chữ Hán với nghĩa {rounds.length > 1 ? `· vòng ${round + 1}/${rounds.length}` : ''}
      </div>
      <div className="match-grid">
        <div className="stack gap-3">
          {left.map((w) => (
            <button key={w.id} className={cellCls(w.id, 'l', selLeft)} disabled={done.has(w.id)}
              style={{ fontSize: 24 }} onClick={() => setSelLeft(w.id)}>
              {w.hanzi}
            </button>
          ))}
        </div>
        <div className="stack gap-3">
          {right.map((w) => (
            <button key={w.id} className={cellCls(w.id, 'r', selRight)} disabled={done.has(w.id)}
              onClick={() => setSelRight(w.id)}>
              {w.meaning}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
