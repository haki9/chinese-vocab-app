import { useEffect, useRef, useState } from 'react';
import type { Word } from '../../db/types';
import type { Lang } from '../../lib/lang';
import { pinyinMatches } from '../../lib/pinyin';
import { speak, ttsAvailable } from '../../lib/tts';

interface Props {
  word: Word;
  lang?: Lang;
  streak: number;
  onReport: (correct: boolean) => void;
  onNext: () => void;
}

const LABEL: Record<Lang, { title: string; placeholder: string }> = {
  zh: { title: 'Gõ pinyin (không cần dấu thanh)', placeholder: 'ví dụ: mingtian' },
  ja: { title: 'Gõ romaji (cách đọc)', placeholder: 'ví dụ: konnichiwa' },
};

export default function TypingQuestion({ word, lang = 'zh', streak, onReport, onNext }: Props) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = LABEL[lang];

  useEffect(() => {
    setValue(''); setResult(null);
    inputRef.current?.focus();
  }, [word.id]);

  const submit = () => {
    if (result !== null || !value.trim()) return;
    const ok = pinyinMatches(word.pinyin, value);
    setResult(ok);
    onReport(ok);
    if (ok) speak(word.hanzi, undefined, lang);
  };

  return (
    <div className="px stack gap-4 grow" style={{ paddingTop: 8 }}>
      <div className="center muted" style={{ fontWeight: 700 }}>{t.title}</div>

      <div className="center stack gap-2" style={{ alignItems: 'center' }}>
        <div className="big-hanzi">{word.hanzi}</div>
        <div className="muted" style={{ fontWeight: 600 }}>{word.meaning}</div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input ref={inputRef} className="text-input" placeholder={t.placeholder}
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
              {ttsAvailable(lang) && (
                <button className="link" style={{ marginLeft: 8 }} onClick={() => speak(word.hanzi, undefined, lang)}>🔊</button>
              )}
            </div>
          </div>
          <button className="btn btn-green" style={{ padding: '10px 20px' }} onClick={onNext}>Tiếp →</button>
        </div>
      )}
    </div>
  );
}
