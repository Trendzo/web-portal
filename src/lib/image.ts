/**
 * Thumbnail URLs for the admin picker.
 *
 * The CMS asset picker renders ~150 tiles at once. Pointing them at the stored preview URL
 * loads every original at full size — the hero posters alone are ~140 KB each, so one grid is
 * roughly 20 MB. These rewrites ask the CDN for a tile-sized rendition instead.
 *
 * Video needs a different treatment entirely: a preview URL for a bundled reel clip is an
 * `.mp4`, and an `<img>` pointed at one renders nothing. Cloudinary can extract a poster frame
 * by swapping the extension, which is the only reason `kind` is a parameter here.
 *
 * Hosts without a transform layer pass through unchanged — see the S3 note below.
 */

/** Already carries a transformation segment? Leave it alone. */
const CLOUDINARY_TRANSFORMED = /\/upload\/[^/]*(?:w_|q_|f_)[^/]*\//;

function isCloudinary(url: string): boolean {
  return url.includes('res.cloudinary.com') && url.includes('/upload/');
}

/**
 * A `px`-wide rendition of `url`, or the original when the host cannot resize.
 *
 * `kind: 'video'` returns a poster frame rather than the clip, so the result is always
 * safe to use as an `<img src>`.
 */
export function thumbUrl(
  url: string | null | undefined,
  px: number,
  kind: 'image' | 'video' = 'image',
): string | null {
  if (!url) return null;

  if (isCloudinary(url)) {
    if (CLOUDINARY_TRANSFORMED.test(url)) return url;
    const sized = url.replace('/upload/', `/upload/w_${px},q_auto,f_auto/`);
    // Cloudinary renders a poster frame when a video is requested with an image extension.
    return kind === 'video' ? sized.replace(/\.(mp4|mov|webm|m4v)$/i, '.jpg') : sized;
  }

  // S3 / CloudFront — the distribution serves objects byte-for-byte, with no resizing function
  // in front of it, so a `?w=` would only bust the cache and return the same bytes. Anything
  // added here has to be provisioned first. A video preview stays an unusable <img> source on
  // this host, which is why callers must handle a video tile having no still.
  return url;
}

/** True when this URL can be shown in an `<img>` at all. */
export function hasStill(url: string | null | undefined, kind: 'image' | 'video'): boolean {
  if (!url) return false;
  return kind === 'image' || isCloudinary(url);
}
