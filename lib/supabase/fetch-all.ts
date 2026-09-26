/**
 * Supabase returns at most 1000 rows per request by default. This keeps
 * asking for the next page until everything is loaded.
 *
 *   const guests = await fetchAll((from, to) =>
 *     supabase.from("guests").select("*").eq("wedding_id", id).order("id").range(from, to));
 *
 * Always include an .order() so pages don't overlap.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
