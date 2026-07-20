import { useEffect, useState } from 'react';
import type { Word } from '../../db/types';
import type { Lang } from '../../lib/lang';
import { speak, ttsAvailable } from '../../lib/tts';

interface Props {
  word: Word;
  lang?: Lang;
  onReport: (correct: boolean) => void;
  onNext: () => void;
}

export default function FlashcardQuestion({ word, lang = 'zh', onReport, onNext }: Props) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { setFlipped(false); }, [word.id]);

  const grade = (remembered: boolean) => {
    onReport(remembered);
    onNext();
  };

  return (
    <div className="px stack gap-4 grow" style={{ paddingTop: 8 }}>
      <div className="center muted" style={{ fontWeight: 700 }}>Chạm thẻ để lật</div>

      <button className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
        <div className="inner">
          <div className="face">
            <div className="big-hanzi">{word.hanzi}</div>
            {ttsAvailable(lang) && (
              <span className="tts-chip" onClick={(e) => { e.stopPropagation(); speak(word.hanzi, undefined, lang); }}>🔊 Nghe</span>
            )}
          </div>
          <div className="face back">
            <div className="h1" style={{ color: 'var(--primary)' }}>{word.pinyin}</div>
            <div className="h2">{word.meaning}</div>
            <div className="muted small">chạm để lật lại</div>
          </div>
        </div>
      </button>

      {flipped && (
        <div className="row gap-3">
          <button className="btn btn-outline grow" style={{ color: 'var(--red)', borderColor: '#f3d3d2' }}
            onClick={() => grade(false)}>😅 Chưa nhớ</button>
          <button className="btn btn-primary grow" style={{ background: 'var(--green)' }}
            onClick={() => grade(true)}>😄 Đã nhớ</button>
        </div>
      )}
    </div>
  );
}
