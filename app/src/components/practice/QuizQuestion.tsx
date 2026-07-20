import { useEffect, useMemo, useState } from 'react';
import type { Word } from '../../db/types';
import { speak, ttsAvailable } from '../../lib/tts';

interface Props {
  word: Word;
  pool: Word[]; // để lấy đáp án nhiễu
  streak: number;
  onReport: (correct: boolean) => void;
  onNext: () => void;
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizQuestion({ word, pool, streak, onReport, onNext }: Props) {
  // Hướng: Hán→Việt hoặc Việt→Hán
  const toViet = useMemo(() => Math.random() < 0.65, [word.id]);
  const options = useMemo(() => {
    const others = shuffle(pool.filter((w) => w.id !== word.id)).slice(0, 3);
    return shuffle([word, ...others]);
  }, [word.id, pool]);

  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked === word.id;

  useEffect(() => { setPicked(null); }, [word.id]);
  useEffect(() => {
    if (toViet) speak(word.hanzi);
  }, [word.id, toViet]);

  const pick = (id: string) => {
    if (picked) return;
    setPicked(id);
    onReport(id === word.id);
  };

  return (
    <div className="px stack gap-4 grow" style={{ paddingTop: 8 }}>
      <div className="center muted" style={{ fontWeight: 700 }}>
        {toViet ? 'Chọn nghĩa đúng' : 'Chọn chữ đúng'}
      </div>

      <div className="center stack gap-3" style={{ alignItems: 'center' }}>
        {toViet ? (
          <>
            <div className="big-hanzi">{word.hanzi}</div>
            {ttsAvailable() ? (
              <button className="tts-chip" onClick={() => speak(word.hanzi)}>🔊 {word.pinyin}</button>
            ) : (
              <span className="tts-chip" style={{ opacity: 0.8 }}>{word.pinyin}</span>
            )}
          </>
        ) : (
          <div className="h1 center" style={{ fontSize: 30, padding: '18px 0' }}>{word.meaning}</div>
        )}
      </div>

      <div className="stack gap-3">
        {options.map((o) => {
          let cls = 'answer-btn';
          if (picked) {
            if (o.id === word.id) cls += ' correct';
            else if (o.id === picked) cls += ' wrong';
          }
          return (
            <button key={o.id} className={cls} onClick={() => pick(o.id)}>
              <span>{toViet ? o.meaning : o.hanzi}</span>
              {picked && o.id === word.id && <span>✓ {correct ? '+5 XP' : ''}</span>}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className={`feedback-bar ${correct ? 'good' : 'bad'}`}>
          <span style={{ fontSize: 26 }}>{correct ? '🎉' : '😅'}</span>
          <div className="grow">
            <div className="t">{correct ? `Chính xác! ${streak >= 2 ? `Chuỗi đúng ×${streak}` : ''}` : 'Chưa đúng — sẽ ôn lại ngay'}</div>
            <div className="s">{word.hanzi} {word.pinyin} — {word.meaning}</div>
          </div>
          <button className="btn btn-green" style={{ padding: '10px 20px' }} onClick={onNext}>Tiếp →</button>
        </div>
      )}
    </div>
  );
}
