/* Circle avatars (24–56px) share one 48px blob per person, so a roster does not decode the stored photo on every row.
   Crew figures keep the stored photo: they are large enough that the face has to be the original. */
const THUMB = 48;
const thumbs = new Map<string, { photo: string; url: string }>();
const inflight = new Map<string, Promise<string>>();

/** The cached thumb, if this person's current photo was already drawn down. */
export function thumbNow(id: string, photo: string): string | null {
  const hit = thumbs.get(id);
  return hit?.photo === photo ? hit.url : null;
}

/** A blob URL for a 48px square of `photo`. The same person shares one draw, and a new photo drops the old URL. */
export function thumbUrl(id: string, photo: string): Promise<string> {
  const ready = thumbNow(id, photo);
  if (ready) return Promise.resolve(ready);
  const key = `${id}\0${photo}`;
  let job = inflight.get(key);
  if (!job) {
    job = makeThumb(photo).then(url => {
      const prev = thumbs.get(id);
      if (prev && prev.url !== url) URL.revokeObjectURL(prev.url);
      thumbs.set(id, { photo, url });
      inflight.delete(key);
      return url;
    }).catch(() => photo);
    inflight.set(key, job);
  }
  return job;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not read the photo.'));
    img.src = src;
  });
}

async function makeThumb(photo: string): Promise<string> {
  const img = await loadImage(photo);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = THUMB;
  const ctx = canvas.getContext('2d');
  if (!ctx) return photo;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, THUMB, THUMB);
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/webp', 0.8))
    ?? await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/jpeg', 0.8));
  return blob ? URL.createObjectURL(blob) : photo;
}
