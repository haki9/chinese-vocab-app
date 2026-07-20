import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProgressRing from '../components/ProgressRing';
import { db, readProfile } from '../db/db';
import { displayStreak, knownWordCount, levelFromXp } from '../lib/gamification';
import { relativeTime } from '../lib/lessons';
import { dueToday, lessonMastery } from '../lib/srs';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng ☀️';
  if (h < 14) return 'Chào buổi trưa 🍚';
  if (h < 18) return 'Chào buổi chiều 🌤️';
  return 'Chào buổi tối 👋';
}

interface LessonRow {
  id: string;
  title: string;
  wordCount: number;
  overall: number;
  dueCount: number;
  lastReviewedAt: number | null;
  createdAt: number;
}

export default function Home() {
  const navigate = useNavigate();
  const [sort, setSort] = useState<'recent' | 'weak'>('recent');

  const data = useLiveQuery(async () => {
    const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt);
    const rows: LessonRow[] = [];
    for (const l of lessons) {
      const words = (await db.words.where('lessonId').equals(l.id).toArray()).filter((w) => !w.deletedAt);
      const ids = words.map((w) => w.id);
      const m = ids.length ? await lessonMastery(ids) : null;
      const states = ids.length ? await db.skillStates.where('wordId').anyOf(ids).toArray() : [];
      const lastReviewedAt = states.reduce<number | null>(
        (acc, s) => (s.lastReviewedAt && (!acc || s.lastReviewedAt > acc) ? s.lastReviewedAt : acc), null);
      rows.push({
        id: l.id, title: l.title, wordCount: ids.length,
        overall: m?.overall ?? 0, dueCount: m?.dueCount ?? 0,
        lastReviewedAt, createdAt: l.createdAt,
      });
    }
    const profile = await readProfile();
    const due = await dueToday();
    const known = await knownWordCount();
    return { rows, profile, due, known };
  }, []);

  const sorted = useMemo(() => {
    const rows = data?.rows ? [...data.rows] : [];
    if (sort === 'weak') rows.sort((a, b) => a.overall - b.overall);
    else rows.sort((a, b) => (b.lastReviewedAt ?? b.createdAt) - (a.lastReviewedAt ?? a.createdAt));
    return rows;
  }, [data?.rows, sort]);

  if (!data) return null;
  const { profile, due, known } = data;
  const level = levelFromXp(profile.xp);
  const streak = displayStreak(profile);
  const dueLessons = sorted.filter((r) => (due.byLesson.get(r.id) ?? 0) > 0);
  const dueTitles = dueLessons.map((r) => r.title.split('·')[0].trim()).slice(0, 3).join(', ');
  const estMinutes = Math.max(1, Math.round(due.total * 0.4));

  const startReview = () => {
    if (dueLessons.length) navigate(`/lesson/${dueLessons[0].id}/practice/quick?due=1`);
  };

  return (
    <>
      <header className="hero">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontWeight: 700 }}>{greeting()}</span>
          <span className="pill">🔥 {streak} ngày</span>
        </div>
        <h1 className="h1 mt-2">Học từ vựng Trung · Nhật</h1>
        <div className="row gap-2 mt-3">
          <span className="pill">⭐ Cấp {level.level} · {profile.xp.toLocaleString('vi-VN')} XP</span>
          <span className="pill">📘 {known} từ đã thuộc</span>
        </div>

        <div className="mt-4" style={{
          background: 'rgba(255,255,255,0.14)', borderRadius: 'var(--radius)',
          padding: '16px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 30 }}>📬</span>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 16.5 }}>
              {due.total > 0 ? `Hôm nay cần ôn ${due.total} từ` : 'Không có từ cần ôn 🎉'}
            </div>
            <div className="small" style={{ color: '#d7e2f7', marginTop: 2 }}>
              {due.total > 0
                ? `${dueTitles ? `Từ ${dueTitles} · ` : ''}~${estMinutes} phút · +${due.total * 3} XP`
                : 'Luyện thêm để giữ chuỗi nhé!'}
            </div>
          </div>
          {due.total > 0 && (
            <button className="btn btn-white" style={{ padding: '11px 18px', borderRadius: 999 }} onClick={startReview}>
              Ôn ngay
            </button>
          )}
        </div>
      </header>

      <section className="px mt-4 stack gap-3">
        <div className="section-head">
          <h2 className="h2">Bài luyện tập của bạn</h2>
          <button className="link small" onClick={() => setSort(sort === 'recent' ? 'weak' : 'recent')}>
            {sort === 'recent' ? 'Gần đây' : 'Yếu nhất'} ▾
          </button>
        </div>

        {sorted.map((r) => (
          <Link to={`/lesson/${r.id}`} key={r.id} className="card lesson-item">
            <ProgressRing percent={r.overall} />
            <div>
              <div className="title">{r.title}</div>
              <div className="sub">
                {r.wordCount} từ
                {r.lastReviewedAt ? ` · luyện ${relativeTime(r.lastReviewedAt)}` : ' · chưa luyện'}
                {r.overall >= 90
                  ? ' · thành thạo 🎉'
                  : (due.byLesson.get(r.id) ?? 0) > 0
                    ? ` · ${due.byLesson.get(r.id)} từ cần ôn`
                    : ''}
              </div>
            </div>
            <span className="chev">›</span>
          </Link>
        ))}

        <button className="dashed-cta" onClick={() => navigate('/scan')}>
          <span style={{ fontSize: 26 }}>📷</span>
          <span>
            <div className="t">Chụp ảnh vở → tạo bài mới</div>
            <div className="s">AI tự nhận chữ, cách đọc, nghĩa — tiếng Trung hoặc Nhật</div>
          </span>
        </button>

        {sorted.length === 0 && (
          <div className="center muted small" style={{ padding: '12px 0 4px' }}>
            Chưa có bài nào — chụp ảnh vở hoặc dán danh sách từ để bắt đầu!
          </div>
        )}
      </section>
    </>
  );
}
