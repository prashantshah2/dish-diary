export type RestaurantSummary = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  cuisine: string | null;
  price_level: number | null;
  author_name: string | null;
  created_by: string | null;
  created_at: string;
  dish_count: number;
  review_count: number;
  is_hidden: boolean;
  lat: number | null;
  lng: number | null;
};

export type DishSummary = {
  id: string;
  restaurant_id: string;
  name: string;
  author_name: string | null;
  created_at: string;
  review_count: number;
  likes: number;
  dislikes: number;
  avg_rating: number | null;
  is_hidden: boolean;
};

export type Review = {
  id: string;
  dish_id: string;
  user_id: string | null;
  author_name: string | null;
  liked: boolean;
  rating: number | null;
  note: string | null;
  visited_on: string | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

export type ReportTarget = 'restaurant' | 'dish' | 'review';

export const CUISINES = [
  'American', 'Chinese', 'Indian', 'Italian', 'Japanese', 'Korean', 'Mediterranean',
  'Mexican', 'Middle Eastern', 'Thai', 'Vietnamese', 'Cafe', 'Bakery', 'Bar', 'Pizza', 'Other',
] as const;

/** Flag for country cuisines; a food emoji where there's no single country. */
const CUISINE_ICONS: Record<string, string> = {
  American: '🇺🇸',
  Chinese: '🇨🇳',
  Indian: '🇮🇳',
  Italian: '🇮🇹',
  Japanese: '🇯🇵',
  Korean: '🇰🇷',
  Mediterranean: '🫒',
  Mexican: '🇲🇽',
  'Middle Eastern': '🧆',
  Thai: '🇹🇭',
  Vietnamese: '🇻🇳',
  Cafe: '☕',
  Bakery: '🥐',
  Bar: '🍺',
  Pizza: '🍕',
  Other: '🍽️',
};

/** "🇮🇳 Indian" — falls back to the plain name for cuisines without an icon. */
export function cuisineLabel(name: string): string {
  const icon = CUISINE_ICONS[name];
  return icon ? `${icon} ${name}` : name;
}

/** Must-try / mixed / skip, from what people said about a dish. */
export function verdict(d: Pick<DishSummary, 'likes' | 'dislikes'>): 'must-try' | 'mixed' | 'skip' | 'untried' {
  const total = d.likes + d.dislikes;
  if (total === 0) return 'untried';
  const ratio = d.likes / total;
  if (ratio >= 0.7) return 'must-try';
  if (ratio <= 0.3) return 'skip';
  return 'mixed';
}
