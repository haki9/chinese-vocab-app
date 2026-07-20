import { useLiveQuery } from 'dexie-react-hooks';
import { readProfile } from '../db/db';
import { BADGES, displayStreak, levelFromXp, todayStr } from '../lib/gamification';

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function weekDates(): string[] {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${x.getFullYear()}-${m}-${dd}`;
  });
}

export default function Rewards() {
  const profile = useLiveQuery(() => readProfile(), []);
  if (!profile) return null;

  const level = levelFromXp(profile.xp);
  const streak = displayStreak(profile);
  const week = weekDates();
  const today = todayStr();
  const active = new Set(profile.activeDates);
  const earned = new Map(profile.badges.map((b) => [b.badgeId, b.earnedAt]));
  const cumulative = level.totalXp;
  const nextLevelAt = cumulative - level.xpInLevel + level.xpNeeded;

  return (
    <>
      <header className="hero center" style={{ paddingBottom: 30 }}>
        <div style={{
          width: 86, height: 86, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
          display: 'grid', placeItems: 'center', fontSize: 42, margin: '8px auto 0',
        }}>🎓</div>
        <h1 className="h2 mt-4" style={{ fontSize: 22 }}>Cấp {level.level} · {level.name}</h1>
        <div className="muted mt-2" style={{ fontWeight: 600 }}>
          {cumulative.toLocaleString('vi-VN')} / {nextLevelAt.toLocaleString('vi-VN')} XP
          — còn {(level.xpNeeded - level.xpInLevel).toLocaleString('vi-VN')} XP lên Cấp {level.level + 1}
        </div>
        <div className="bar mt-3" style={{ height: 10, maxWidth: 320, margin: '14px auto 0' }}>
          <i style={{ width: `${Math.round((level.xpInLevel / level.xpNeeded) * 100)}%` }} />
        </div>
      </header>

      <div className="px mt-4 stack gap-4">
        <div className="card">
          <div className="section-head">
            <h2 className="h3">🔥 Chuỗi {streak} ngày</h2>
            <span className="muted small">kỷ lục: {profile.streakBest} ngày</span>
          </div>
          <div className="streak-week mt-3">
            {week.map((date, i) => {
              const isToday = date === today;
              const done = active.has(date);
              return (
                <div key={date} className={`streak-day ${isToday ? 'today' : ''}`}>
                  <div className={`box ${isToday && done ? 'today' : done ? 'done' : isToday ? 'today' : ''}`}>
                    {done ? (isToday ? '✓' : '🔥') : isToday ? '·' : ''}
                  </div>
                  <span className="d">{DAY_LABELS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="h3">Huy hiệu</h2>
          <div className="badge-grid mt-4">
            {BADGES.map((b) => {
              const has = earned.has(b.id);
              return (
                <div key={b.id} className={`badge ${has ? '' : 'locked'}`}
                  title={b.description + (has ? ` · đạt ${new Date(earned.get(b.id)!).toLocaleDateString('vi-VN')}` : '')}>
                  <div className="circle">{b.emoji}</div>
                  <span className="t">{b.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
