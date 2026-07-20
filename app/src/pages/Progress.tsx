import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, readProfile, readSettings } from '../db/db';
import type { Word } from '../db/types';
import { displayStreak, knownWordCount } from '../lib/gamification';

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function startOfWeek(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // T2 = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export default function ProgressPage() {
  const navigate = useNavigate();

  const data = useLiveQuery(async () => {
    const profile = await readProfile();
    const known = await knownWordCount();
    const settings = await readSettings();

    // % thành thạo chung
    const states = await db.skillStates.toArray();
    const activeStates = states.filter((s) => s.repetitions > 0 || s.wrongCount > 0);
    const masterySum = states.reduce(
      (acc, s) => acc + Math.min(100, Math.round((s.intervalDays / 21) * 100)), 0);
    const overall = states.length ? Math.round(masterySum / states.length) : 0;

    // biểu đồ tuần
    const weekStart = startOfWeek().getTime();
    const logs = await db.reviewLogs.where('at').aboveOrEqual(weekStart).toArray();
    const byDay = new Array(7).fill(0) as number[];
    for (const l of logs) {
      const d = new Date(l.at);
      byDay[(d.getDay() + 6) % 7]++;
    }

    // từ hay sai nhất (30 ngày)
    const monthAgo = Date.now() - 30 * 86400000;
    const recent = await db.reviewLogs.where('at').aboveOrEqual(monthAgo).toArray();
    const wrongCount = new Map<string, number>();
    for (const l of recent) if (!l.correct) wrongCount.set(l.wordId, (wrongCount.get(l.wordId) ?? 0) + 1);
    const topWrongIds = [...wrongCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const fetched = await db.words.bulkGet(topWrongIds.map(([wid]) => wid));
    const wrongWords: { word: Word; count: number }[] = [];
    fetched.forEach((w, i) => {
      if (w && !w.deletedAt) wrongWords.push({ word: w, count: topWrongIds[i][1] });
    });

    return { profile, known, overall: activeStates.length ? overall : 0, byDay, wrongWords, settings };
  }, []);

  if (!data) return null;
  const { profile, known, overall, byDay, wrongWords, settings } = data;
  const todayCol = (new Date().getDay() + 6) % 7;
  const maxDay = Math.max(1, ...byDay);
  const weekTotal = byDay.reduce((a, b) => a + b, 0);

  const practiceWrong = () => {
    if (wrongWords.length) navigate(`/lesson/${wrongWords[0].word.lessonId}/practice/quick`);
  };

  const exportBackup = async () => {
    const dump = {
      v: 1, exportedAt: new Date().toISOString(),
      lessons: await db.lessons.toArray(),
      words: await db.words.toArray(),
      skillStates: await db.skillStates.toArray(),
      reviewLogs: await db.reviewLogs.toArray(),
      profile: await db.profile.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wigo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importBackup = async (file: File) => {
    try {
      const dump = JSON.parse(await file.text());
      if (dump.v !== 1) throw new Error('bad version');
      await db.transaction('rw', db.tables, async () => {
        await db.lessons.bulkPut(dump.lessons ?? []);
        await db.words.bulkPut(dump.words ?? []);
        await db.skillStates.bulkPut(dump.skillStates ?? []);
        await db.reviewLogs.bulkPut(dump.reviewLogs ?? []);
        await db.profile.bulkPut(dump.profile ?? []);
        await db.settings.bulkPut(dump.settings ?? []);
      });
      alert('Đã khôi phục dữ liệu ✓');
    } catch {
      alert('File backup không hợp lệ.');
    }
  };

  return (
    <>
      <header className="card" style={{ borderRadius: 0, padding: '20px 20px 16px' }}>
        <h1 className="h1" style={{ fontSize: 23 }}>Tiến độ của bạn</h1>
      </header>

      <div className="px mt-4 stack gap-4">
        <div className="stat-grid">
          <div className="card stat-card">
            <div className="v" style={{ color: 'var(--primary)' }}>{known}</div>
            <div className="l">từ đã thuộc</div>
          </div>
          <div className="card stat-card">
            <div className="v" style={{ color: 'var(--orange-deep)' }}>🔥 {displayStreak(profile)}</div>
            <div className="l">ngày liên tiếp</div>
          </div>
          <div className="card stat-card">
            <div className="v" style={{ color: 'var(--green)' }}>{overall}%</div>
            <div className="l">thành thạo chung</div>
          </div>
        </div>

        <div className="card">
          <div className="section-head">
            <h2 className="h3">Tuần này</h2>
            <span className="muted small">{weekTotal} từ đã ôn</span>
          </div>
          <div className="week-chart mt-3">
            {byDay.map((n, i) => (
              <div key={i} className={`col ${i === todayCol ? 'today' : ''}`}>
                <div className="bar-v" style={{ height: `${Math.max(4, (n / maxDay) * 100)}%` }} />
                <span className="d">{DAY_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-head">
            <h2 className="h3">Từ hay sai nhất</h2>
            {wrongWords.length > 0 && <button className="link small" onClick={practiceWrong}>Luyện ngay</button>}
          </div>
          {wrongWords.length === 0 ? (
            <div className="muted small mt-3">Chưa có dữ liệu — luyện tập để xem thống kê nhé!</div>
          ) : (
            <div className="stack mt-2">
              {wrongWords.map(({ word, count }) => (
                <div key={word.id} className="row gap-3" style={{ padding: '10px 0', borderBottom: '1px solid #f0f3f8' }}>
                  <span style={{ fontSize: 24, fontWeight: 700, minWidth: 60 }}>{word.hanzi}</span>
                  <span className="muted grow">{word.pinyin} · {word.meaning}</span>
                  <span style={{
                    background: count >= 5 ? '#fdeeee' : '#fdeeda',
                    color: count >= 5 ? 'var(--red)' : 'var(--orange-deep)',
                    fontWeight: 700, fontSize: 13, borderRadius: 999, padding: '5px 11px',
                  }}>sai {count} lần</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="h3">Cài đặt & dữ liệu</h2>
          <label className="row mt-3" style={{ justifyContent: 'space-between' }}>
            <span>Âm thanh hiệu ứng</span>
            <input type="checkbox" checked={settings.soundOn} style={{ width: 20, height: 20 }}
              onChange={(e) => db.settings.update('app', { soundOn: e.target.checked, updatedAt: Date.now() })} />
          </label>
          <div className="row gap-2 mt-3">
            <button className="btn btn-outline grow" style={{ padding: '11px' }} onClick={exportBackup}>
              ⬇️ Xuất backup
            </button>
            <label className="btn btn-outline grow" style={{ padding: '11px' }}>
              ⬆️ Khôi phục
              <input type="file" accept="application/json" hidden
                onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
