import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import type { Lang } from '../lib/lang';
import { lessonWords, splitLessonTitle } from '../lib/lessons';
import { lessonMastery } from '../lib/srs';
import type { PracticeMode, Skill } from '../db/types';

function buildModes(lang: Lang): { mode: PracticeMode; ico: string; t: string; s: string; skill: Skill | null }[] {
  const chWord = lang === 'ja' ? 'Kanji' : 'Hán';
  return [
    { mode: 'vocab', ico: '📚', t: 'Từ vựng', s: 'Xem & nghe', skill: null },
    { mode: 'flashcard', ico: '🃏', t: 'Flashcard', s: 'Lật thẻ ghi nhớ', skill: 'recognize' },
    { mode: 'quiz', ico: '✅', t: 'Trắc nghiệm', s: `${chWord} ↔ Việt`, skill: 'recognize' },
    { mode: 'typing', ico: '⌨️', t: lang === 'ja' ? 'Gõ romaji' : 'Gõ pinyin', s: lang === 'ja' ? 'Theo cách đọc' : 'Không cần dấu thanh', skill: 'pinyin' },
    { mode: 'match', ico: '🔗', t: 'Nối từ', s: `Ghép ${chWord} — nghĩa`, skill: 'recognize' },
    { mode: 'writing', ico: '✍️', t: 'Tập viết', s: 'Thứ tự nét chữ', skill: 'write' },
  ];
}

function skillLabel(lang: Lang): Record<Skill, string> {
  return {
    recognize: 'Nhận mặt chữ',
    pinyin: lang === 'ja' ? 'Gõ romaji' : 'Gõ pinyin',
    write: 'Tập viết',
  };
}

export default function Lesson() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const lesson = await db.lessons.get(id);
    if (!lesson) return null;
    const words = await lessonWords(id);
    const mastery = await lessonMastery(words.map((w) => w.id));
    return { lesson, words, mastery };
  }, [id]);

  if (!data) return null;
  const { lesson, words, mastery } = data;
  const lang: Lang = lesson.lang ?? 'zh';
  const MODES = buildModes(lang);
  const SKILL_LABEL = skillLabel(lang);
  const pinyinTitle = words.slice(0, 5).map((w) => w.pinyin).join(' ');
  const [numPart, hanziPart] = splitLessonTitle(lesson.title);

  const del = async () => {
    if (!confirm('Xóa bài học này? Tiến độ SRS của các từ trong bài cũng sẽ mất.')) return;
    const now = Date.now();
    await db.lessons.update(lesson.id, { deletedAt: now, updatedAt: now });
    navigate('/', { replace: true });
  };

  return (
    <>
      <header className="hero" style={{ paddingBottom: 28 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="row gap-2" style={{ color: '#d7e2f7', fontWeight: 700 }} onClick={() => navigate('/')}>
            ← Trang chủ
          </button>
          <button className="icon-btn" style={{ color: '#d7e2f7' }} onClick={del}>⋯</button>
        </div>
        <h1 className="h1 mt-3" style={{ fontSize: 30 }}>{hanziPart || lesson.title}</h1>
        <div className="muted mt-2" style={{ fontWeight: 600 }}>
          {numPart ? `${numPart} · ` : ''}{words.length} từ{pinyinTitle ? ` · ${pinyinTitle}` : ''}
        </div>
        <div className="row gap-3 mt-4">
          {(['recognize', 'pinyin', 'write'] as Skill[]).map((sk) => (
            <div key={sk} className="grow">
              <div className="row small" style={{ justifyContent: 'space-between', fontWeight: 700 }}>
                <span style={{ color: '#d7e2f7' }}>{SKILL_LABEL[sk]}</span>
                <span>{mastery[sk]}%</span>
              </div>
              <div className="bar mt-2"><i style={{ width: `${mastery[sk]}%` }} /></div>
            </div>
          ))}
        </div>
      </header>

      <div className="px mt-4 stack gap-4">
        <div className="mode-grid">
          {MODES.map((m) => (
            <button key={m.mode} className="mode-card"
              onClick={() => navigate(`/lesson/${lesson.id}/practice/${m.mode}`)}>
              {m.skill === mastery.weakestSkill && mastery.overall > 0 && m.mode !== 'flashcard' && m.mode !== 'match' && (
                <span className="tag">yếu nhất</span>
              )}
              <span className="ico">{m.ico}</span>
              <span className="t">{m.t}</span>
              <span className="s">{m.mode === 'vocab' ? `Xem & nghe ${words.length} từ` : m.s}</span>
            </button>
          ))}
        </div>

        <button className="btn btn-orange" style={{ padding: '16px 20px' }}
          onClick={() => navigate(`/lesson/${lesson.id}/practice/quick`)}>
          <span style={{ fontSize: 18 }}>⚡ Luyện nhanh 5 phút</span>
          <span style={{ fontWeight: 600, fontSize: 13.5, opacity: 0.95 }}>
            Trộn các chế độ, ưu tiên từ yếu · +25 XP
          </span>
        </button>
      </div>
    </>
  );
}
