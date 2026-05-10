/**
 * Avatar image preprocessing — shrink to ~20 KB JPEG before Supabase upload.
 *
 * Why: at 1000 users × ~30 avatar loads/day × original ~100 KB images we'd
 * burn through Supabase's 5 GB/mo free egress in ~4 days. Shrinking here cuts
 * egress 5× and lets us stay on the free tier through the early-access ramp.
 *
 * Strategy:
 *   1. Resize longer side to 512 px (Avatar component renders at most ~96 pt
 *      retina, so 512 px is plenty even on Pro Max screens).
 *   2. JPEG-encode at quality 0.7. Target file size lands ~25–40 KB for
 *      typical avatar content. Acceptable for our display sizes.
 *   3. Caller passes the manipulated URI to Supabase Storage.
 *
 * Each upload sets `cacheControl: "31536000"` so the served object has
 * `Cache-Control: max-age=31536000`, letting CDN/browsers cache the bytes
 * for a year. File names are timestamp-suffixed (`{userId}-{ts}.jpg`) so
 * URL changes naturally bust the cache when a user updates their avatar.
 */

import * as ImageManipulator from "expo-image-manipulator";

export type ProcessedAvatar = {
  uri:        string;
  width:      number;
  height:     number;
  /** "image/jpeg" — what to pass to Supabase upload contentType. */
  mimeType:   "image/jpeg";
  /** "jpg" — what to use as the file extension. */
  extension:  "jpg";
};

/** Resize + JPEG-compress an image picker asset for avatar upload. */
export async function processAvatarForUpload(sourceUri: string): Promise<ProcessedAvatar> {
  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 512 } }],
    {
      compress:    0.7,
      format:      ImageManipulator.SaveFormat.JPEG,
    },
  );
  return {
    uri:       result.uri,
    width:     result.width,
    height:    result.height,
    mimeType:  "image/jpeg",
    extension: "jpg",
  };
}
