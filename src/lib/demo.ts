import { removePhotosFor } from './photos';
import { supabase } from './supabase';

/**
 * Fixed ids of the fictional restaurants loaded by supabase/demo/demo-setup.sql
 * (for README screenshots). Deleting them cascades to their dishes and reviews.
 */
export const DEMO_RESTAURANT_IDS = [1, 2, 3, 4, 5, 6].map((n) => `de000000-0000-4000-8000-${String(n).padStart(12, '0')}`);

/** How many demo restaurants are currently loaded (admins see hidden ones too). */
export async function countDemoRestaurants(): Promise<number> {
  const { count } = await supabase
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .in('id', DEMO_RESTAURANT_IDS);
  return count ?? 0;
}

/** Deletes all demo data. Photo files go first (the database cascade doesn't touch Storage). */
export async function removeDemoData(): Promise<string | null> {
  for (const id of DEMO_RESTAURANT_IDS) {
    const photoError = await removePhotosFor('restaurant', id);
    if (photoError) return `Couldn’t delete demo photos: ${photoError}`;
  }
  const { error } = await supabase.from('restaurants').delete().in('id', DEMO_RESTAURANT_IDS);
  return error?.message ?? null;
}
