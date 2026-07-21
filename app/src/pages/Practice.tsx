import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import FlashcardQuestion from '../components/practice/FlashcardQuestion';
import MatchBoard from '../components/practice/MatchBoard';
import QuizQuestion from '../components/practice/QuizQuestion';
import TypingQuestion from '../components/practice/TypingQuestion';
import VocabBrowser from '../components/practice/VocabBrowser';
import VocabList from '../components/practice/VocabList';
import WritingQuestion from '../components/practice/WritingQuestion';
import CelebrateModal from '../components/CelebrateModal';
import { db } from '../db/db';
import type { Lesson, PracticeMode, Word } from '../db/types';
import type { Lang } from '../lib/lang';
import {
  confettiBig, confettiBurst, playCorrect, playLevelUp, playSessionDone, playWrong,
} from '../lib/feedback';
import {
  addXpAndTouchStreak, checkBadges, XP_CORRECT, XP_QUICK_SESSION, XP_SESSION_DONE, XP_STREAK_BONUS,
  type LevelInfo, type BadgeDef,
} from '../lib/gamification';
import { lessonWords } from '../lib/lessons';
import { pickWeakWords, recordAnswer } from '../lib/srs';

interface Question {
  word: Word;
  mode: Exclude<PracticeMode, 'quick' | 'vocab' | 'match'>;
  retried: boolean;
}

const QUICK_COUNT = 12;
const SESSION_CAP = 15;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Practice() {
  const { id, mode } = useParams<{ id: string; mode: PracticeMode }>();
  const [params] = useSearchParams();
  const dueOnly = params.get('due') === '1';
  const navigate = useNavigate();

  const [words, setWords] = useState<Word[] | null>(null);
  const [lang, setLang] = useState<Lang>('zh');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [vocabView, setVocabView] = useState<'list' | 'browse'>('list');
  const [vocabWords, setVocabWords] = useState<Word[]>([]);
  const [vocabStart, setVocabStart] = useState(0);
  const [queue, setQueue] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [xp, setXp] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'playing' | 'done'>('loading');
  const [levelUp, setLevelUp] = useState<LevelInfo | null>(null);
  const [newBadges, setNewBadges] = useState<BadgeDef[]>([]);
  const finishedRef = useRef(false);

  // Nạp từ + dựng hàng đợi câu hỏi
  useEffect(() => {
    (async () => {
      if (!id || !mode) return;
      const l = await db.lessons.get(id);
      setLesson(l ?? null);
      setLang(l?.lang ?? 'zh');
      setVocabView('list');
      let ws = await lessonWords(id);
      if (!ws.length) { navigate(`/lesson/${id}`, { replace: true }); return; }

      if (mode === 'quick') {
        let pool = ws;
        if (dueOnly) {
          const now = Date.now();
          const states = await db.skillStates.where('wordId').anyOf(ws.map((w) => w.id)).toArray();
          const dueIds = new Set(states.filter((s) => s.dueAt <= now && s.repetitions > 0).map((s) => s.wordId));
          const dueWords = ws.filter((w) => dueIds.has(w.id));
          if (dueWords.length) pool = dueWords;
        }
        const pickedIds = await pickWeakWords(pool.map((w) => w.id), QUICK_COUNT);
        const byId = new Map(pool.map((w) => [w.id, w]));
        const picked = pickedIds.map((wid) => byId.get(wid)!).filter(Boolean);
        const modes: Question['mode'][] = ['quiz', 'typing', 'flashcard'];
        setQueue(picked.map((w, i) => ({ word: w, mode: modes[i % modes.length], retried: false })));
        setWords(ws);
      } else if (mode === 'vocab' || mode === 'match') {
        setWords(ws);
      } else {
        const picked = shuffle(ws).slice(0, SESSION_CAP);
        setQueue(picked.map((w) => ({ word: w, mode: mode as Question['mode'], retried: false })));
        setWords(ws);
      }
      setPhase('playing');
    })();
  }, [id, mode]);

  const q = queue[idx];

  const report = async (correct: boolean) => {
    if (!q) return;
    setAnswered((a) => a + 1);
    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setCorrectCount((c) => c + 1);
      setXp((x) => x + XP_CORRECT + (newStreak >= 5 ? XP_STREAK_BONUS : 0));
      playCorrect();
      if (newStreak > 0 && newStreak % 5 === 0) confettiBurst();
    } else {
      setStreak(0);
      playWrong();
    }
    await recordAnswer(q.word.id, q.mode, correct, { retried: q.retried });
    // sai → ôn lại cuối phiên (1 lần)
    if (!correct && !q.retried) {
      setQueue((qs) => [...qs, { ...q, retried: true }]);
    }
  };

  const next = () => {
    if (idx + 1 < queue.length) setIdx(idx + 1);
    else finishSession();
  };

  // match mode: báo kết quả từng từ
  const reportMatchWord = async (wordId: string, correct: boolean) => {
    setAnswered((a) => a + 1);
    if (correct) {
      setCorrectCount((c) => c + 1);
      setXp((x) => x + XP_CORRECT);
    }
    await recordAnswer(wordId, 'match', correct);
  };

  const finishSession = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const bonus = mode === 'quick' ? XP_QUICK_SESSION : XP_SESSION_DONE;
    const totalXp = xp + bonus;
    const { leveledUp, newLevel } = await addXpAndTouchStreak(totalXp);
    const earned = await checkBadges();
    setXp(totalXp);
    setPhase('done');
    confettiBig();
    if (leveledUp) { setLevelUp(newLevel); playLevelUp(); }
    else playSessionDone();
    if (earned.length) setNewBadges(earned);
  };

  if (phase === 'loading' || !words) return null;

  // ===== Màn tổng kết =====
  if (phase === 'done') {
    const acc = answered ? Math.round((correctCount / answered) * 100) : 100;
    return (
      <div className="px stack gap-4 grow center" style={{ justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ fontSize: 64 }}>🎉</div>
        <div className="h1">Hoàn thành!</div>
        <div className="muted">
          {answered > 0 ? <>Đúng <b>{correctCount}/{answered}</b> ({acc}%) · </> : null}
          +<b>{xp} XP</b>
        </div>
        <div className="stack gap-3 mt-3" style={{ width: '100%' }}>
          <button className="btn btn-primary btn-block" onClick={() => navigate(`/lesson/${id}`, { replace: true })}>
            Về bài học
          </button>
          <button className="btn btn-outline btn-block" onClick={() => navigate('/', { replace: true })}>
            Trang chủ
          </button>
        </div>
        {levelUp && (
          <CelebrateModal emoji="⭐" title={`Lên Cấp ${levelUp.level}!`}
            subtitle={`Danh hiệu mới: ${levelUp.name}`} onClose={() => setLevelUp(null)} />
        )}
        {!levelUp && newBadges.length > 0 && (
          <CelebrateModal emoji={newBadges[0].emoji} title={`Huy hiệu: ${newBadges[0].title}`}
            subtitle={newBadges[0].description}
            onClose={() => setNewBadges((b) => b.slice(1))} />
        )}
      </div>
    );
  }

  // ===== Thanh trên: progress + chuỗi =====
  const progress = mode === 'vocab' || mode === 'match'
    ? null
    : Math.round((idx / Math.max(1, queue.length)) * 100);

  const showVocabList = mode === 'vocab' && vocabView === 'list';
  const showVocabBrowse = mode === 'vocab' && vocabView === 'browse';

  return (
    <>
      {!showVocabList && !showVocabBrowse && (
        <div className="practice-top">
          <button className="icon-btn" onClick={() => navigate(`/lesson/${id}`)}>✕</button>
          {progress !== null ? (
            <div className="bar"><i style={{ width: `${progress}%` }} /></div>
          ) : <div className="grow" />}
          <span style={{ fontWeight: 800, color: 'var(--orange-deep)' }}>🔥 {streak}</span>
        </div>
      )}

      {showVocabList && lesson && (
        <VocabList lesson={lesson} lang={lang}
          onOpenWord={(ws, i) => { setVocabWords(ws); setVocabStart(i); setVocabView('browse'); }}
          onRenamed={(title) => setLesson((l) => (l ? { ...l, title } : l))} />
      )}

      {showVocabBrowse && id && (
        <VocabBrowser words={vocabWords} lang={lang} startIndex={vocabStart} lessonId={id}
          onExit={() => setVocabView('list')} onFinished={finishSession} />
      )}

      {mode === 'match' && (
        <MatchBoard words={words} lang={lang} onWordResult={reportMatchWord} onFinished={finishSession} />
      )}

      {q && q.mode === 'quiz' && (
        <QuizQuestion word={q.word} pool={words} lang={lang} streak={streak} onReport={report} onNext={next} />
      )}
      {q && q.mode === 'typing' && (
        <TypingQuestion word={q.word} lang={lang} streak={streak} onReport={report} onNext={next} />
      )}
      {q && q.mode === 'flashcard' && (
        <FlashcardQuestion word={q.word} lang={lang} onReport={report} onNext={next} />
      )}
      {q && q.mode === 'writing' && (
        <WritingQuestion word={q.word} lang={lang} onReport={report} onNext={next} />
      )}
    </>
  );
}
