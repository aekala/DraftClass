/**
 * nfl.com headshots are large landscape photos (often 1400×1000 up to 3400×2450).
 * Their image service can crop around the face and resize on the fly, so ask it for a
 * small square face crop instead of downloading the full photo for a tiny circle.
 * URLs from anywhere else are returned unchanged.
 */
const NFL_IMAGE = /^(https:\/\/static\.www\.nfl\.com\/image\/(?:private|upload)\/)f_auto,q_auto\//;

export function portraitUrl(url: string, size: number): string {
  return url.replace(NFL_IMAGE, `$1c_thumb,g_face,w_${size},h_${size},f_auto,q_auto/`);
}
