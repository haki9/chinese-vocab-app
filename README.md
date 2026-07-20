# WIGO — Học từ vựng tiếng Trung cho người Việt

Web app luyện từ vựng tiếng Trung: **chụp/quét vở viết tay** (Hán tự + pinyin + nghĩa Việt) → AI trích xuất → tạo bài luyện với 6 chế độ, SRS kiểu SM-2 theo từng từ × từng kỹ năng, gamification (XP, streak, huy hiệu). Thiết kế bám 7 mockup trong `Design/`.

## Cấu trúc

```
app/     SPA React + Vite + TS — deploy tĩnh (GitHub Pages), PWA, dữ liệu local-first (IndexedDB/Dexie)
worker/  Cloudflare Worker — proxy /api/ocr giấu ANTHROPIC_API_KEY, Turnstile + rate limit
Design/  7 mockup PNG chuẩn thiết kế
```

## Chạy local

```sh
# App
cd app
npm install
npm run dev          # http://localhost:5173

# Worker (cần cho tính năng quét OCR)
cd worker
npm install
# tạo worker/.dev.vars:
#   ANTHROPIC_API_KEY=sk-ant-...
# (không đặt TURNSTILE_SECRET khi dev → worker bỏ qua bước verify)
npx wrangler dev     # http://localhost:8787
```

Mặc định app dev gọi `http://localhost:8787/api/ocr`. Không chạy worker thì mọi tính năng khác (dán văn bản, nhập tay, luyện tập, SRS…) vẫn hoạt động đầy đủ.

## Deploy

### 1. Worker (Cloudflare)

```sh
cd worker
npx wrangler kv namespace create RATE_KV     # điền id trả về vào wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put TURNSTILE_SECRET     # secret key của widget Turnstile
npx wrangler deploy
```

Sau đó sửa `wrangler.toml`:
- `ALLOWED_ORIGIN` = origin GitHub Pages (vd `https://<user>.github.io`)
- `IP_DAILY_LIMIT` / `GLOBAL_DAILY_LIMIT` = hạn mức quét/ngày theo IP và toàn cục (trần chi phí)
- `OCR_DISABLED = "true"` = kill-switch tắt khẩn cấp

Tạo widget **Turnstile** tại dash.cloudflare.com → Turnstile (domain = domain GitHub Pages), lấy site key + secret key.

### 2. App (GitHub Pages)

Repo Settings → Pages → Source: **GitHub Actions**. Workflow `.github/workflows/deploy.yml` tự build và deploy khi push `main`.

Đặt 2 **Repository variables** (Settings → Secrets and variables → Actions → Variables):
- `VITE_OCR_URL` — URL worker, vd `https://wigo-ocr.<account>.workers.dev/api/ocr`
- `VITE_TURNSTILE_SITE_KEY` — site key Turnstile

## Bảo mật & chi phí (app công khai)

- API key **chỉ** nằm trong Worker secret — không bao giờ xuất hiện ở client.
- Mỗi request OCR: verify Turnstile → rate limit theo IP/ngày (KV) → trần tổng toàn cục/ngày → giới hạn 5 ảnh ≤1.5MB.
- Model: `claude-opus-4-8` (vision + structured output). Một lần quét 1 trang ≈ vài cent.
- Nên bật cảnh báo billing ở cả Anthropic Console lẫn Cloudflare.

## Ghi chú kỹ thuật

- **HashRouter** để GitHub Pages không 404 khi refresh.
- **SRS**: SM-2 đơn giản, 1 bản ghi/(từ × kỹ năng); kỹ năng: nhận mặt chữ / gõ pinyin / tập viết. % thành thạo = interval/21 ngày.
- **Gõ pinyin không cần dấu thanh**: chuẩn hóa NFD bỏ dấu, `ü→u`, chấp nhận `v`.
- **TTS**: Web Speech API voice `zh-CN`; thiết bị không có voice → ẩn nút loa kèm ghi chú.
- **Tập viết**: hanzi-writer, char-data tải theo nhu cầu từ jsDelivr + cache Service Worker.
- **Backup**: Xuất/khôi phục JSON trong trang Tiến độ (đề phòng Safari dọn IndexedDB). Schema có sẵn `updatedAt`/`deletedAt` để sau này sync tài khoản đám mây.
