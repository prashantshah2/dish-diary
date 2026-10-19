import { todayISO } from './dates';
import { supabase } from './supabase';

type Row = Record<string, unknown>;

const PAGE = 1000; // Supabase returns at most 1000 rows per request

async function fetchAll(table: string, select: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('created_at')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

/**
 * Downloads every restaurant, dish, review and report — hidden ones included —
 * as one Excel workbook with a sheet per table. Admins only (RLS lets admins
 * read everything); web only, since it saves through the browser.
 */
export async function exportAllToExcel(): Promise<{ fileName: string; counts: Record<string, number> }> {
  const [restaurants, dishes, reviews, reports] = await Promise.all([
    fetchAll('restaurants', '*'),
    fetchAll('dishes', '*, restaurants(name)'),
    fetchAll('reviews', '*, dishes(name, restaurants(name))'),
    fetchAll('reports', '*'),
  ]);

  // Replace nested objects with readable name columns.
  const dishRows = dishes.map(({ restaurants: r, ...d }) => ({
    ...d,
    restaurant_name: (r as { name?: string } | null)?.name ?? '',
  }));
  const reviewRows = reviews.map(({ dishes: d, ...v }) => {
    const dish = d as { name?: string; restaurants?: { name?: string } | null } | null;
    return { ...v, dish_name: dish?.name ?? '', restaurant_name: dish?.restaurants?.name ?? '' };
  });

  // Loaded on demand so the spreadsheet library isn't in every visitor's download.
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const sheets: [string, Row[]][] = [
    ['Restaurants', restaurants],
    ['Dishes', dishRows],
    ['Reviews', reviewRows],
    ['Reports', reports],
  ];
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  const fileName = `dish-diary-${todayISO()}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return {
    fileName,
    counts: Object.fromEntries(sheets.map(([name, rows]) => [name, rows.length])),
  };
}
