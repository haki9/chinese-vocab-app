import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Turnstile from '../components/Turnstile';
import { compressImage } from '../lib/image';
import { requestOcr, OcrError } from '../lib/ocrClient';
import { parsePastedText } from '../lib/lessons';
import { useDraft } from '../store/draft';

const MAX_PAGES = 5;

export default function Scan() {
  const navigate = useNavigate();
  const setDraft = useDraft((s) => s.setDraft);

  // Chụp ảnh mới — mở app camera gốc của máy (không mô phỏng viewfinder trong trang).
  const cameraRef = useRef<HTMLInputElement>(null);
  // Chọn ảnh có sẵn — mở Thư viện ảnh/Gallery, không ép mở camera.
  const galleryRef = useRef<HTMLInputElement>(null);

  const [pages, setPages] = useState<string[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  const atMax = pages.length >= MAX_PAGES;

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = [...files].slice(0, MAX_PAGES - pages.length);
    const b64s = await Promise.all(list.map((f) => compressImage(f)));
    setPages((p) => [...p, ...b64s]);
  };

  const runOcr = useCallback(async () => {
    if (!pages.length || busy) return;
    setBusy(true);
    setError('');
    try {
      const words = await requestOcr(pages, token || 'dev');
      setDraft(words, 'ocr', pages);
      navigate('/scan/review');
    } catch (e) {
      setError(e instanceof OcrError ? e.message : 'Có lỗi xảy ra, thử lại nhé.');
    } finally {
      setBusy(false);
    }
  }, [pages, busy, token, setDraft, navigate]);

  const submitPaste = async () => {
    const words = await parsePastedText(pasteText);
    if (!words.length) return;
    setDraft(words, 'paste');
    navigate('/scan/review');
  };

  const manualEntry = () => {
    setDraft([{ hanzi: '', pinyin: '', meaning: '', confidence: 1 }], 'manual');
    navigate('/scan/review');
  };

  return (
    <>
      <header className="card" style={{ borderRadius: 0, display: 'flex', gap: 14, alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => navigate(-1)}>✕</button>
        <div>
          <div className="h3">Tạo bài mới từ vở</div>
          <div className="muted small">Bước 1/3 · Chụp ảnh</div>
        </div>
      </header>

      <div className="px mt-4 stack gap-4">
        {pages.length > 0 && (
          <div className="card row gap-3" style={{ padding: '12px 14px' }}>
            <div className="row gap-2 grow" style={{ flexWrap: 'wrap' }}>
              {pages.map((p, i) => (
                <span key={i} style={{ position: 'relative' }}>
                  <img src={`data:image/jpeg;base64,${p}`} alt={`trang ${i + 1}`}
                    style={{ width: 46, height: 60, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #d6e0f0' }} />
                  <button onClick={() => setPages((ps) => ps.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute', top: -6, right: -6, background: 'var(--red)', color: '#fff',
                      borderRadius: '50%', width: 18, height: 18, fontSize: 11, lineHeight: 1,
                    }}>✕</button>
                </span>
              ))}
            </div>
            <button className="btn btn-primary" style={{ padding: '11px 16px' }} onClick={runOcr} disabled={busy || !pages.length}>
              {busy ? 'Đang đọc…' : `Nhận dạng ${pages.length} trang →`}
            </button>
          </div>
        )}

        {error && (
          <div className="tip" style={{ background: '#fdeeee', color: 'var(--red)' }}>⚠️ {error}</div>
        )}

        <div className="scan-actions">
          <button className="scan-action" style={{ opacity: atMax ? 0.5 : 1 }} disabled={atMax}
            onClick={() => cameraRef.current?.click()}>
            <span className="ico">📷</span>Chụp ảnh
          </button>
          <button className="scan-action" style={{ opacity: atMax ? 0.5 : 1 }} disabled={atMax}
            onClick={() => galleryRef.current?.click()}>
            <span className="ico">🖼️</span>Thư viện ảnh
          </button>
          <button className="scan-action" onClick={() => setPasteOpen(true)}>
            <span className="ico">📋</span>Dán văn bản
          </button>
          <button className="scan-action" onClick={manualEntry}>
            <span className="ico">⌨️</span>Nhập tay
          </button>
        </div>

        <div className="tip">
          <span>💡</span>
          <span>Có thể chụp hoặc chọn nhiều trang liên tiếp — hệ thống sẽ gộp vào một bài.</span>
        </div>

        <Turnstile onToken={setToken} />
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />

      {pasteOpen && (
        <div className="modal-backdrop" onClick={() => setPasteOpen(false)}>
          <div className="modal" style={{ maxWidth: 400, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <div className="h3">Dán danh sách từ</div>
            <div className="muted small mt-2">
              Mỗi dòng một từ: <b>汉字 pinyin nghĩa</b>. Thiếu pinyin sẽ được tự điền để bạn duyệt lại.
            </div>
            <textarea className="text-input mt-3" placeholder={'明天 míngtiān ngày mai\n昨天 hôm qua'}
              value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
            <div className="row gap-2 mt-3">
              <button className="btn btn-outline grow" onClick={() => setPasteOpen(false)}>Hủy</button>
              <button className="btn btn-primary grow" onClick={submitPaste} disabled={!pasteText.trim()}>
                Tiếp tục →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
