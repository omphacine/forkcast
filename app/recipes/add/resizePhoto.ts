// Shrinks a photo in the browser before it's uploaded for scanning. Phone
// photos are several MB each, and several of them together would blow past
// the 10 MB upload limit (and the model's 5 MB per-image limit). 1568px on the
// long edge is the size the model downsamples to anyway, so recipe text stays
// just as readable.
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;

export async function resizePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  // JPEG has no transparency — without a backdrop a transparent PNG
  // (screenshots, say) comes out black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode photo"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
