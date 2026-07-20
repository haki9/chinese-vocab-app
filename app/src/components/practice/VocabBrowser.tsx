import { useState } from 'react';
import type { Word } from '../../db/types';
import { speak, ttsAvailable } from '../../lib/tts';

interface Props {
  words: Word[];
  onFinished: () => void;
}

export default function VocabBrowser({ words, onFinished }: Props) {
  const [idx, setIdx] = useState(0);
  const w = words[idx];
  if (!w) return null;
  const tts = ttsAvailable();

  return (
    <div className="px stack gap-4 grow" style={{ paddingTop: 8 }}>
      <div className="center muted" style={{ fontWeight: 700 }}>Từ {idx + 1}/{words.length}</div>

      <div className="card center stack gap-3" style={{ padding: '36px 20px', alignItems: 'center', borderRadius: 'var(--radius-lg)' }}>
        <div className="big-hanzi">{w.hanzi}</div>
        <div className="h2" style={{ color: 'var(--primary)' }}>{w.pinyin}</div>
        <div className="h3">{w.meaning}</div>
        {tts ? (
          <button className="tts-chip" onClick={() => speak(w.hanzi)}>🔊 Phát âm</button>
        ) : (
          <span className="muted small">Thiết bị không hỗ trợ phát âm tiếng Trung</span>
        )}
      </div>

      <div className="row gap-3" style={{ marginTop: 'auto' }}>
        <button className="btn btn-outline grow" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Trước</button>
        {idx + 1 < words.length ? (
          <button className="btn btn-primary grow" onClick={() => { setIdx(idx + 1); }}>
            Tiếp →
          </button>
        ) : (
          <button className="btn btn-primary grow" onClick={onFinished}>Hoàn thành ✓</button>
        )}
      </div>
    </div>
  );
}
