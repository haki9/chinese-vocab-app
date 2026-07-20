import { useEffect, useRef, useState } from 'react';
import type { Word } from '../../db/types';
import { pinyinMatches } from '../../lib/pinyin';
import { speak, ttsAvailable } from '../../lib/tts';

interface Props {
  word: Word;
  streak: number;
  onReport: (correct: boolean) => void;
  onNext: () => void;
}

export default function TypingQuestion({ word, streak, onReport, onNext }: Props) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(''); setResult(null);
    inputRef.current?.focus();
  }, [word.id]);

  const submit = () => {
    if (result !== null || !value.trim()) return;
    const ok = pinyinMatches(word.pinyin, value);
    setResult(ok);
    onReport(ok);
    if (ok) speak(word.hanzi);
  };

  return (
    <div className="px stack gap-4 grow" style={{ paddingTop: 8 }}>
      <div className="center muted" style={{ fontWeight: 700 }}>Gõ pinyin (không cần dấu thanh)</div>

      <div className="center stack gap-2" style={{ alignItems: 'center' }}>
        <div className="big-hanzi">{word.hanzi}</div>
        <div className="muted" style={{ fontWeight: 600 }}>{word.meaning}</div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input ref={inputRef} className="text-input" placeholder="ví dụ: mingtian"
          autoCapitalize="off" autoCorrect="off" spellCheck={false}
          value={value} onChange={(e) => setValue(e.target.value)} disabled={result !== null} />
        {result === null && (
          <button type="submit" className="btn btn-primary btn-block mt-3" disabled={!value.trim()}>
            Kiểm tra
          </button>
        )}
      </form>

      {result !== null && (
        <div className={`feedback-bar ${result ? 'good' : 'bad'}`}>
          <span style={{ fontSize: 26 }}>{result ? '🎉' : '😅'}</span>
          <div className="grow">
            <div className="t">{result ? `Chính xác! ${streak >= 2 ? `Chuỗi đúng ×${streak}` : ''}` : 'Chưa đúng'}</div>
            <div className="s">
              Đáp án: <b>{word.pinyin}</b>
              {ttsAvailable() && (
                <button className="link" style={{ marginLeft: 8 }} onClick={() => speak(word.hanzi)}>🔊</button>
              )}
            </div>
          </div>
          <button className="btn btn-green" style={{ padding: '10px 20px' }} onClick={onNext}>Tiếp →</button>
        </div>
      )}
    </div>
  );
}
