/** Resize + nén ảnh client-side trước khi gửi OCR (giảm token + băng thông) */
export async function compressImage(source: Blob, maxDim = 1568, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  c.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return dataUrl.split(',')[1]; // base64 không kèm prefix
}
