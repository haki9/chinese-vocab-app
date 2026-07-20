import { useEffect, useRef, useState } from 'react';
import type HanziWriterType from 'hanzi-writer';
import type { Word } from '../../db/types';
import type { Lang } from '../../lib/lang';
import { speak } from '../../lib/tts';

interface Props {
  word: Word;
  lang?: Lang;
  onReport: (correct: boolean) => void;
  onNext: () => void;
}

/** Tập viết từng chữ Hán/Kanji trong từ theo thứ tự nét (hanzi-writer quiz) — chữ kana không có dữ liệu nét nên bị lọc khỏi `chars` */
export default function WritingQuestion({ word, lang = 'zh', onReport, onNext }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<ReturnType<typeof HanziWriterType.create> | null>(null);
  const [charIdx, setCharIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState<null | boolean>(null);
  const [loadError, setLoadError] = useState(false);

  const chars = [...word.hanzi].filter((c) => /[㐀-鿿]/.test(c));

  useEffect(() => {
    setCharIdx(0); setMistakes(0); setFinished(null); setLoadError(false);
  }, [word.id]);

  useEffect(() => {
    if (finished !== null || !boxRef.current || !chars[charIdx]) return;
    let disposed = false;
    (async () => {
    const { default: HanziWriter } = await import('hanzi-writer');
    if (disposed || !boxRef.current) return;
    boxRef.current.innerHTML = '';
    try {
      const writer = HanziWriter.create(boxRef.current, chars[charIdx], {
        width: 260, height: 260, padding: 10,
        showCharacter: false, showOutline: true,
        strokeColor: '#3b6fd4', drawingColor: '#1c2b46', outlineColor: '#dfe7f3',
        onLoadCharDataError: () => { if (!disposed) setLoadError(true); },
      });
      writerRef.current = writer;
      writer.quiz({
        showHintAfterMisses: 2,
        onComplete: (summary: { totalMistakes: number }) => {
          if (disposed) return;
          const total = mistakes + summary.totalMistakes;
          if (charIdx + 1 < chars.length) {
            setMistakes(total);
            setCharIdx(charIdx + 1);
          } else {
            const ok = total <= chars.length; // cho phép ~1 nét sai mỗi chữ
            setFinished(ok);
            onReport(ok);
            speak(word.hanzi, undefined, lang);
          }
        },
      });
    } catch {
      setLoadError(true);
    }
    })();
    return () => { disposed = true; };
  }, [charIdx, word.id, finished !== null]);

  if (!chars.length || loadError) {
    const noKanjiAtAll = !chars.length && !loadError;
    return (
      <div className="px stack gap-4 grow center" style={{ paddingTop: 24 }}>
        <div style={{ fontSize: 40 }}>✍️</div>
        <div className="muted">
          {noKanjiAtAll
            ? <>Từ “{word.hanzi}” không có chữ Hán/Kanji để tập viết (chỉ có kana).</>
            : <>Chưa có dữ liệu nét cho chữ “{chars[charIdx] ?? word.hanzi}”.</>}
          <br />Bỏ qua từ này nhé.
        </div>
        <button className="btn btn-primary" onClick={onNext}>Tiếp →</button>
      </div>
    );
  }

  return (
    <div className="px stack gap-4 grow" style={{ paddingTop: 8, alignItems: 'center' }}>
      <div className="center muted" style={{ fontWeight: 700 }}>
        Viết chữ theo thứ tự nét {chars.length > 1 ? `· chữ ${charIdx + 1}/${chars.length}` : ''}
      </div>
      <div className="center">
        <div className="h2">{word.pinyin} — {word.meaning}</div>
        <div className="muted small mt-2">Vẽ chữ <b style={{ fontSize: 18 }}>{chars[charIdx]}</b> vào khung bên dưới</div>
      </div>
      <div className="writer-box"><div ref={boxRef} /></div>
      <div className="center muted small">Sai 2 nét sẽ tự hiện gợi ý nét tiếp theo</div>

      {finished !== null && (
        <div className={`feedback-bar ${finished ? 'good' : 'bad'}`} style={{ width: '100%' }}>
          <span style={{ fontSize: 26 }}>{finished ? '🎉' : '😅'}</span>
          <div className="grow">
            <div className="t">{finished ? 'Viết đẹp lắm!' : `Sai ${mistakes} nét — luyện thêm nhé`}</div>
            <div className="s">{word.hanzi} {word.pinyin} — {word.meaning}</div>
          </div>
          <button className="btn btn-green" style={{ padding: '10px 20px' }} onClick={onNext}>Tiếp →</button>
        </div>
      )}
    </div>
  );
}
