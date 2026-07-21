import { useEffect, useMemo, useRef, useState } from 'react';
import type HanziWriterType from 'hanzi-writer';
import { useNavigate } from 'react-router-dom';
import type { Word } from '../../db/types';

interface Props {
  word: Word;
  lessonId: string;
}

const CJK = /[㐀-鿿]/;

/** Xem trước thứ tự nét (mô phỏng, không chấm điểm) — "Tập viết theo" dẫn sang chế độ luyện Tập viết đầy đủ của cả bài */
export default function WritingPreview({ word, lessonId }: Props) {
  const navigate = useNavigate();
  const chars = useMemo(() => [...word.hanzi].filter((c) => CJK.test(c)), [word.hanzi]);
  const [active, setActive] = useState(0);
  const [strokeCounts, setStrokeCounts] = useState<Record<string, number>>({});
  const [slow, setSlow] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<ReturnType<typeof HanziWriterType.create> | null>(null);

  useEffect(() => { setActive(0); setSlow(false); }, [word.id]);

  // số nét cho phần chú thích — tải riêng, không ảnh hưởng animation đang chạy
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { default: HanziWriter } = await import('hanzi-writer');
      for (const c of chars) {
        if (strokeCounts[c] !== undefined) continue;
        try {
          const data = await HanziWriter.loadCharacterData(c);
          if (!cancelled) setStrokeCounts((m) => ({ ...m, [c]: (data as { strokes: string[] }).strokes.length }));
        } catch {
          // không có dữ liệu nét cho chữ này — bỏ qua số nét, vẫn hiện chữ
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chars.join('')]);

  useEffect(() => {
    if (!boxRef.current || !chars[active]) return;
    let disposed = false;
    setLoadError(false);
    (async () => {
      const { default: HanziWriter } = await import('hanzi-writer');
      if (disposed || !boxRef.current) return;
      boxRef.current.innerHTML = '';
      try {
        const writer = HanziWriter.create(boxRef.current, chars[active], {
          width: 132, height: 132, padding: 8,
          strokeAnimationSpeed: slow ? 0.4 : 1,
          delayBetweenStrokes: slow ? 500 : 200,
          strokeColor: '#3b6fd4', outlineColor: '#dfe7f3',
          onLoadCharDataError: () => { if (!disposed) setLoadError(true); },
        });
        writerRef.current = writer;
        writer.animateCharacter();
      } catch {
        setLoadError(true);
      }
    })();
    return () => { disposed = true; };
  }, [chars, active, slow]);

  if (!chars.length) return null;

  const replay = () => writerRef.current?.animateCharacter();

  return (
    <div className="card stack gap-3">
      <div className="muted small" style={{ fontWeight: 700, letterSpacing: 0.5 }}>CÁCH VIẾT</div>

      <div className="stroke-grid">
        {chars.map((c, i) => (
          <button key={i} className={`stroke-box ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
            {i === active ? <div ref={boxRef} /> : <div className="stroke-static">{c}</div>}
            <div className="muted small" style={{ marginTop: 6 }}>
              {strokeCounts[c] ? `${strokeCounts[c]} nét · ` : ''}{i === active ? 'đang mô phỏng ✍️' : 'chạm để xem'}
            </div>
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="muted small">Chưa có dữ liệu nét cho chữ "{chars[active]}".</div>
      ) : (
        <>
          <div className="row gap-2">
            <button className="btn btn-outline grow" onClick={replay}>▶ Chạy lại</button>
            <button className="btn btn-outline grow" onClick={() => setSlow((s) => !s)}>
              🐌 {slow ? 'Bình thường' : 'Chậm'}
            </button>
          </div>
          <button className="btn btn-primary btn-block"
            onClick={() => navigate(`/lesson/${lessonId}/practice/writing`)}>
            🔥 Tập viết theo
          </button>
        </>
      )}

      <div className="center muted small">Mô phỏng thứ tự nét từng chữ · có thể luyện viết theo ô ly</div>
    </div>
  );
}
