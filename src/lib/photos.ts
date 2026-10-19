import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';
import type { ReviewPhoto } from './types';

const BUCKET = 'review-photos';
const FULL_MAX_PX = 1280; // longest side
const THUMB_MAX_PX = 400;

/** A photo picked on the device, not uploaded yet. */
export type LocalPhoto = { uri: string; width: number; height: number };

/** Opens the photo library (several at once) or the camera. Returns [] if cancelled. */
export async function pickPhotos(source: 'library' | 'camera', remaining: number): Promise<LocalPhoto[]> {
  if (remaining <= 0) return [];
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error('Camera access is off. Allow it in Settings to take photos.');
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
    });
  }
  if (result.canceled) return [];
  return result.assets.slice(0, remaining).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Shrinks to at most `maxPx` on the longest side and re-encodes as JPEG (drops EXIF/GPS). */
async function shrink(photo: LocalPhoto, maxPx: number, compress: number) {
  // Load first to get the real size (the picker's width/height can be missing on web).
  let image = await ImageManipulator.manipulate(photo.uri).renderAsync();
  const scale = maxPx / Math.max(image.width, image.height);
  if (scale < 1) {
    // Pass both sides: the web version computes a zero height when one is left null.
    image = await ImageManipulator.manipulate(image)
      .resize({ width: Math.round(image.width * scale), height: Math.round(image.height * scale) })
      .renderAsync();
  }
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  return { bytes: base64ToBytes(saved.base64 ?? ''), width: saved.width, height: saved.height };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * Shrinks and uploads photos for a review the current user wrote:
 * "<userId>/<reviewId>/<id>.jpg" (≤1280 px) plus "-thumb.jpg" (≤400 px).
 * Stops at the first failure (e.g. the daily limit) and reports it.
 */
export async function uploadReviewPhotos(reviewId: string, userId: string, photos: LocalPhoto[]): Promise<string | null> {
  for (const photo of photos) {
    const [full, thumb] = await Promise.all([shrink(photo, FULL_MAX_PX, 0.7), shrink(photo, THUMB_MAX_PX, 0.6)]);
    const base = `${userId}/${reviewId}/${randomId()}`;
    const path = `${base}.jpg`;
    const thumbPath = `${base}-thumb.jpg`;
    const options = { contentType: 'image/jpeg', cacheControl: '31536000' };

    const uploads = await Promise.all([
      supabase.storage.from(BUCKET).upload(path, full.bytes, options),
      supabase.storage.from(BUCKET).upload(thumbPath, thumb.bytes, options),
    ]);
    const uploadError = uploads.find((u) => u.error)?.error;
    if (uploadError) {
      await supabase.storage.from(BUCKET).remove([path, thumbPath]);
      return `Photo upload failed: ${uploadError.message}`;
    }

    const { error } = await supabase.from('review_photos').insert({
      review_id: reviewId,
      path,
      thumb_path: thumbPath,
      width: full.width,
      height: full.height,
      bytes: full.bytes.length + thumb.bytes.length,
    });
    if (error) {
      // e.g. the 3-per-review or 10-per-day limit — don't leave the files behind.
      await supabase.storage.from(BUCKET).remove([path, thumbPath]);
      return error.message;
    }
  }
  return null;
}

/** Deletes photos: files first (through the Storage API), then their rows. */
export async function removePhotos(photos: Pick<ReviewPhoto, 'id' | 'path' | 'thumb_path'>[]): Promise<string | null> {
  if (!photos.length) return null;
  const { error: fileError } = await supabase.storage.from(BUCKET).remove(photos.flatMap((p) => [p.path, p.thumb_path]));
  if (fileError) return fileError.message;
  const { error } = await supabase.from('review_photos').delete().in('id', photos.map((p) => p.id));
  return error?.message ?? null;
}

/** Removes every photo on the given reviews (call before deleting the reviews). */
export async function removePhotosForReviews(reviewIds: string[]): Promise<string | null> {
  if (!reviewIds.length) return null;
  const { data, error } = await supabase.from('review_photos').select('id, path, thumb_path').in('review_id', reviewIds);
  if (error) return error.message;
  return removePhotos(data ?? []);
}

/** Removes every photo on a dish's or restaurant's reviews (call before an admin deletes it). */
export async function removePhotosFor(target: 'dish' | 'restaurant', id: string): Promise<string | null> {
  const query =
    target === 'dish'
      ? supabase.from('review_photos').select('id, path, thumb_path, reviews!inner(dish_id)').eq('reviews.dish_id', id)
      : supabase
          .from('review_photos')
          .select('id, path, thumb_path, reviews!inner(dishes!inner(restaurant_id))')
          .eq('reviews.dishes.restaurant_id', id);
  const { data, error } = await query;
  if (error) return error.message;
  return removePhotos((data ?? []) as Pick<ReviewPhoto, 'id' | 'path' | 'thumb_path'>[]);
}

export function photoUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
