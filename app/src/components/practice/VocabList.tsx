import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import type { Lesson, Word } from '../../db/types';
import type { Lang } from '../../lib/lang';
import { lessonWords, splitLessonTitle } from '../../lib/lessons';
import { recognizeStatuses, type WordStatus } from '../../lib/srs';
import { speakSequence, ttsAvailable } from '../../lib/tts';

interface Props {
  lesson: Lesson;
  lang: Lang;
  onOpenWord: (words: Word[], index: number) => void;
}

type Filter = 'all' | 'due' | 'starred';

export default function VocabList({ lesson, lang, onOpenWord }: Props) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const data = useLiveQuery(async () => {
    const words = await lessonWords(lesson.id);
    const statuses = await recognizeStatuses(words.map((w) => w.id));
    return { words, statuses };
  }, [lesson.id]);

  const words = data?.words ?? [];
  const statuses = data?.statuses ?? new Map<string, { status: WordStatus; wrongCount: number }>();

  const dueCount = words.filter((w) => statuses.get(w.id)?.status === 'due').length;
  const knownCount = words.filter((w) => statuses.get(w.id)?.status === 'known').length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      if (filter === 'due' && statuses.get(w.id)?.status !== 'due') return false;
      if (filter === 'starred' && !w.starred) return false;
      if (q && !(w.hanzi.includes(query.trim()) || w.pinyin.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [words, statuses, filter, query]);

  const [numPart, hanziPart] = splitLessonTitle(lesson.title);
  const tts = ttsAvailable(lang);

  const toggleStar = (w: Word) => {
    db.words.update(w.id, { starred: !w.starred, updatedAt: Date.now() });
  };

  const playAll = () => {
    speakSequence(filtered.map((w) => w.hanzi), lang);
  };

  return (
    <>
      <header className="hero" style={{ paddingBottom: 22 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="row gap-2" style={{ color: '#d7e2f7', fontWeight: 700 }}
            onClick={() => navigate(`/lesson/${lesson.id}`)}>
            ← {numPart || 'Bài học'}
          </button>
          <span className="row gap-2" style={{ fontWeight: 700, fontSize: 14 }}>📖 Từ vựng</span>
        </div>
        <h1 className="h1 mt-3" style={{ fontSize: 26 }}>{hanziPart}</h1>
        <div className="hero-stats mt-4">
          <div className="hero-stat">
            <div className="v">{words.length}</div>
            <div className="l">tổng từ</div>
          </div>
          <div className="hero-stat">
            <div className="v">{knownCount}</div>
            <div className="l">đã thuộc</div>
          </div>
          <div className="hero-stat">
            <div className="v">{dueCount}</div>
            <div className="l">cần ôn</div>
          </div>
        </div>
      </header>

      <div className="px mt-4 stack gap-3" style={{ paddingBottom: 110 }}>
        <div className="row gap-3">
          <div className="search-box grow">
            <span>🔍</span>
            <input placeholder="Tìm từ..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {tts && (
            <button className="tts-chip" style={{ opacity: filtered.length ? 1 : 0.5, whiteSpace: 'nowrap' }}
              onClick={playAll} disabled={!filtered.length}>🔊 Nghe tất cả</button>
          )}
        </div>

        <div className="filter-row">
          <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            Tất cả {words.length}
          </button>
          <button className={`filter-chip ${filter === 'due' ? 'active' : ''}`} onClick={() => setFilter('due')}>
            Cần ôn {dueCount}
          </button>
          <button className={`filter-chip ${filter === 'starred' ? 'active' : ''}`} onClick={() => setFilter('starred')}>
            ⭐ Đã đánh dấu
          </button>
        </div>

        {filtered.map((w) => {
          const st = statuses.get(w.id);
          const due = st?.status === 'due';
          const warn = due ? (st!.wrongCount > 0 ? '⚠ hay sai · cần ôn' : '⚠ cần ôn') : null;
          return (
            <button key={w.id} className={`vocab-row ${due ? 'due' : ''}`}
              onClick={() => onOpenWord(filtered, filtered.indexOf(w))}>
              <span className="hz">{w.hanzi}</span>
              <span className="info">
                <span className="py">{w.pinyin}</span>
                <span className="mn">{w.meaning}</span>
                {warn && <span className="warn">{warn}</span>}
              </span>
              <span className="actions">
                <span className={`status-dot ${st?.status ?? 'new'}`} />
                {tts && (
                  <span className="icon-btn" style={{ width: 30, height: 30, fontSize: 15, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); speakSequence([w.hanzi], lang); }}>🔊</span>
                )}
                <span className={`star-btn ${w.starred ? 'on' : ''}`} style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); toggleStar(w); }}>
                  {w.starred ? '★' : '☆'}
                </span>
              </span>
            </button>
          );
        })}

        {data && filtered.length === 0 && (
          <div className="center muted small" style={{ padding: '12px 0' }}>Không tìm thấy từ nào phù hợp.</div>
        )}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, width: '100%', maxWidth: 480, background: '#fff',
        borderTop: '1px solid #e8edf5', padding: '14px 16px calc(14px + env(safe-area-inset-bottom))',
        zIndex: 50,
      }}>
        <button className="btn btn-primary btn-block" disabled={!filtered.length}
          onClick={() => onOpenWord(filtered, 0)}>
          Luyện {filtered.length} từ này →
        </button>
      </div>
    </>
  );
}
