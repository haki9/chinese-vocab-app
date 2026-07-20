import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkBadges } from '../lib/gamification';
import { createLesson, nextLessonNumber } from '../lib/lessons';
import { CONFIDENCE_THRESHOLD, useDraft } from '../store/draft';

export default function ScanReview() {
  const navigate = useNavigate();
  const { words, pages, source, updateWord, removeWord, addWord, clear } = useDraft();
  const [lessonNo, setLessonNo] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Đánh dấu đã lưu thành công để chặn effect bên dưới điều hướng nhầm về /scan
  // khi clear() làm words rỗng ngay trước lúc chuyển sang trang bài học.
  const savedRef = useRef(false);

  useEffect(() => { nextLessonNumber().then(setLessonNo); }, []);
  useEffect(() => {
    if (!words.length && !savedRef.current) navigate('/scan', { replace: true });
  }, [words.length, navigate]);

  const lowCount = words.filter((w) => w.confidence < CONFIDENCE_THRESHOLD && !w.touched).length;
  const validWords = words.filter((w) => w.hanzi.trim());

  const save = async () => {
    if (!validWords.length || saving) return;
    setSaving(true);
    const firstHanzi = validWords[0].hanzi;
    const title = `Bài ${lessonNo} · ${firstHanzi.length <= 8 ? firstHanzi : firstHanzi.slice(0, 8) + '…'}`;
    const id = await createLesson(title, validWords, source);
    await checkBadges(); // "Bài đầu tiên"
    savedRef.current = true;
    navigate(`/lesson/${id}`, { replace: true });
    clear();
  };

  return (
    <>
      <header className="card" style={{ borderRadius: 0, display: 'flex', gap: 14, alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => navigate(-1)}>←</button>
        <div className="grow">
          <div className="h3">Kiểm tra kết quả</div>
          <div className="muted small">
            Bước 2/3 · {source === 'ocr' ? `AI đọc được ${words.length} từ` : `${words.length} từ`}
          </div>
        </div>
        {lowCount > 0 && (
          <span style={{
            background: '#fdeeda', color: 'var(--orange-deep)', fontWeight: 700,
            fontSize: 13.5, borderRadius: 999, padding: '6px 12px',
          }}>{lowCount} cần xem</span>
        )}
      </header>

      <div className="px mt-4 stack gap-3" style={{ paddingBottom: 110 }}>
        {pages.length > 0 && (
          <button className="camera-inner" style={{ minHeight: 64, borderStyle: 'dashed', borderColor: '#b9c9e6', borderRadius: 'var(--radius)' }}
            onClick={() => setZoom(pages[0])}>
            <span style={{ color: '#8b98b3', fontFamily: 'monospace', fontSize: 13.5 }}>
              ảnh vở đã chụp · chạm để phóng to ({pages.length} trang)
            </span>
          </button>
        )}

        {words.map((w) => {
          const low = w.confidence < CONFIDENCE_THRESHOLD && !w.touched;
          return (
            <div key={w.key} className={`review-row ${low ? 'low' : ''}`}>
              <input className="hz" value={w.hanzi} placeholder="汉字"
                onChange={(e) => updateWord(w.key, { hanzi: e.target.value })} />
              <span className="py">
                <input value={w.pinyin} placeholder="pinyin"
                  onChange={(e) => updateWord(w.key, { pinyin: e.target.value })} />
              </span>
              <input value={w.meaning} placeholder="nghĩa tiếng Việt"
                onChange={(e) => updateWord(w.key, { meaning: e.target.value })} />
              {low ? (
                <span style={{ fontSize: 18 }}>✏️</span>
              ) : (
                <button className="icon-btn" style={{ width: 30, height: 30, fontSize: 15, color: 'var(--text-3)' }}
                  onClick={() => removeWord(w.key)} title="Xóa từ">🗑️</button>
              )}
              {low && <span className="warn">⚠️ Không chắc — chạm để sửa (sửa xong sẽ hết cảnh báo)</span>}
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, width: '100%', maxWidth: 480, background: '#fff',
        borderTop: '1px solid #e8edf5', padding: '14px 16px calc(14px + env(safe-area-inset-bottom))',
        display: 'flex', gap: 12, zIndex: 50,
      }}>
        <button className="btn btn-outline" onClick={addWord}>+ Thêm từ</button>
        <button className="btn btn-primary grow" onClick={save} disabled={!validWords.length || saving}>
          Lưu thành Bài {lessonNo || '…'} →
        </button>
      </div>

      {zoom && (
        <div className="modal-backdrop" onClick={() => setZoom(null)} style={{ padding: 12 }}>
          <div style={{ maxHeight: '90vh', overflow: 'auto', borderRadius: 12 }}>
            {pages.map((p, i) => (
              <img key={i} src={`data:image/jpeg;base64,${p}`} alt={`trang ${i + 1}`}
                style={{ width: '100%', display: 'block', marginBottom: 8 }} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
