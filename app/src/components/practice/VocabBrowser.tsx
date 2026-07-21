import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type ReactNode } from 'react';
import { db } from '../../db/db';
import type { Word, WordDetail } from '../../db/types';
import type { Lang } from '../../lib/lang';
import { toneBreakdown } from '../../lib/pinyin';
import { formatDueDate, skillStateId, stateMastery } from '../../lib/srs';
import { speak, speakSequence, ttsAvailable } from '../../lib/tts';
import { getOrFetchWordDetail } from '../../lib/wordDetail';
import WritingPreview from './WritingPreview';

interface Props {
  words: Word[];
  lang?: Lang;
  startIndex?: number;
  lessonId: string;
  onExit: () => void;
  onFinished: () => void;
}

/** Bôi màu chỗ xuất hiện của `target` trong `text` (không tìm thấy → trả nguyên văn) */
function highlight(text: string, target: string): ReactNode {
  if (!target) return text;
  const parts = text.split(target);
  if (parts.length === 1) return text;
  const out: ReactNode[] = [];
  parts.forEach((p, i) => {
    if (p) out.push(<span key={`t${i}`}>{p}</span>);
    if (i < parts.length - 1) {
      out.push(<span key={`h${i}`} style={{ color: 'var(--primary)', fontWeight: 800 }}>{target}</span>);
    }
  });
  return out;
}

export default function VocabBrowser({ words, lang = 'zh', startIndex = 0, lessonId, onExit, onFinished }: Props) {
  const [idx, setIdx] = useState(startIndex);
  const [starOverride, setStarOverride] = useState<boolean | null>(null);
  const [toneLine, setToneLine] = useState('');
  const [detail, setDetail] = useState<WordDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const w = words[idx];

  const recognizeState = useLiveQuery(
    async () => (w ? db.skillStates.get(skillStateId(w.id, 'recognize')) : undefined),
    [w?.id],
  );

  useEffect(() => {
    setStarOverride(null);
  }, [w?.id]);

  useEffect(() => {
    let cancelled = false;
    setToneLine('');
    if (lang === 'zh' && w) {
      toneBreakdown(w.hanzi).then((t) => { if (!cancelled) setToneLine(t); });
    }
    return () => { cancelled = true; };
  }, [w?.id, lang]);

  const loadDetail = () => {
    if (!w) return;
    let cancelled = false;
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    getOrFetchWordDetail(w, lang)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setDetailError(e instanceof Error ? e.message : 'Có lỗi xảy ra'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  };

  useEffect(loadDetail, [w?.id, lang]);

  if (!w) return null;
  const tts = ttsAvailable(lang);
  const starred = starOverride ?? w.starred ?? false;

  const toggleStar = () => {
    const next = !starred;
    setStarOverride(next);
    db.words.update(w.id, { starred: next, updatedAt: Date.now() });
  };

  const masteryPct = stateMastery(recognizeState);
  const due = !!recognizeState && recognizeState.repetitions > 0 && recognizeState.dueAt <= Date.now();
  const filledSegments = Math.round(masteryPct / 20);
  const segColor = due ? 'var(--orange-deep)' : 'var(--green)';

  const playAllSentences = () => {
    if (detail?.sentences.length) speakSequence(detail.sentences.map((s) => s.text), lang, 0.85);
  };

  return (
    <>
      <div className="practice-top">
        <button className="icon-btn" onClick={onExit}>✕</button>
        <div className="grow center muted" style={{ fontWeight: 700 }}>Từ {idx + 1}/{words.length}</div>
        <button className="icon-btn" style={{ color: starred ? 'var(--orange-deep)' : undefined }} onClick={toggleStar}>
          {starred ? '★' : '☆'}
        </button>
      </div>

      <div className="px mt-3 stack gap-3" style={{ paddingBottom: 110 }}>
        <div className="card center stack gap-2" style={{ padding: '28px 20px', alignItems: 'center', borderRadius: 'var(--radius-lg)' }}>
          <div className="big-hanzi">{w.hanzi}</div>
          {tts ? (
            <button className="tts-chip" onClick={() => speak(w.hanzi, 0.75, lang)}>🔊 {w.pinyin}</button>
          ) : (
            <span className="tts-chip" style={{ opacity: 0.8 }}>{w.pinyin}</span>
          )}
          <div className="muted small">{toneLine ? `${toneLine} · ` : ''}chạm loa để nghe chậm</div>
        </div>

        <div className="card stack gap-2">
          <div className="muted small" style={{ fontWeight: 700, letterSpacing: 0.5 }}>NGHĨA</div>
          <div className="h3">{w.meaning}</div>
          {detail?.note && <div className="muted small">{detail.note}</div>}
        </div>

        <WritingPreview word={w} lessonId={lessonId} />

        {detailLoading && (
          <div className="card center muted small" style={{ padding: 18 }}>Đang tạo từ ghép & mẫu câu…</div>
        )}
        {detailError && (
          <div className="card stack gap-2" style={{ padding: 16 }}>
            <div className="muted small">⚠️ {detailError}</div>
            <button className="btn btn-outline" onClick={loadDetail}>Thử lại</button>
          </div>
        )}

        {!!detail?.combos.length && (
          <div className="card stack gap-2">
            <div className="muted small" style={{ fontWeight: 700, letterSpacing: 0.5 }}>TỪ GHÉP HAY DÙNG</div>
            <div className="stack gap-2">
              {detail.combos.map((c, i) => (
                <button key={i} className="combo-chip" onClick={() => tts && speak(c.text, undefined, lang)}>
                  <b>{c.text}</b> <span className="muted small">{c.reading} · {c.meaning}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!!detail?.sentences.length && (
          <div className="card stack gap-3">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="muted small" style={{ fontWeight: 700, letterSpacing: 0.5 }}>{detail.sentences.length} MẪU CÂU</div>
              {tts && <button className="link small" onClick={playAllSentences}>🔊 Nghe tất cả</button>}
            </div>
            <div className="stack gap-3">
              {detail.sentences.map((s, i) => (
                <div key={i} className="sentence-row">
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{highlight(s.text, w.hanzi)}</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: 2 }}>{s.reading}</div>
                  <div className="muted small" style={{ marginTop: 2 }}>{s.meaning}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card stack gap-2">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="muted small" style={{ fontWeight: 700, letterSpacing: 0.5 }}>MỨC THUỘC</div>
            {due && <span style={{ color: 'var(--orange-deep)', fontWeight: 700, fontSize: 13 }}>Cần ôn</span>}
          </div>
          <div className="row gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="mastery-segment" style={{ background: i < filledSegments ? segColor : '#e4eaf4' }} />
            ))}
          </div>
          <div className="muted small">
            {recognizeState?.wrongCount ? `Đã sai ${recognizeState.wrongCount} lần · ` : ''}
            {recognizeState ? `lịch ôn tiếp theo: ${formatDueDate(recognizeState.dueAt)}` : 'chưa luyện — hãy thử chế độ Trắc nghiệm'}
          </div>
        </div>
      </div>

      <div style={{
        position: 'fixed', bottom: 0, width: '100%', maxWidth: 480, background: '#fff',
        borderTop: '1px solid #e8edf5', padding: '14px 16px calc(14px + env(safe-area-inset-bottom))',
        display: 'flex', gap: 12, zIndex: 50,
      }}>
        <button className="btn btn-outline grow" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          ‹ {words[idx - 1]?.hanzi ?? 'Trước'}
        </button>
        {idx + 1 < words.length ? (
          <button className="btn btn-primary grow" onClick={() => setIdx(idx + 1)}>
            {words[idx + 1].hanzi} ›
          </button>
        ) : (
          <button className="btn btn-primary grow" onClick={onFinished}>Hoàn thành ✓</button>
        )}
      </div>
    </>
  );
}
