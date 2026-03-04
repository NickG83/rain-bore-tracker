export async function onRequestGet(ctx) {
  const { results } = await ctx.env.DB.prepare(`
    SELECT
      substr(entry_date, 1, 4) AS year,
      substr(entry_date, 6, 2) AS month,
      SUM(COALESCE(rain_mm, 0)) AS rain_mm_total
    FROM entries
    WHERE rain_mm IS NOT NULL
    GROUP BY year, month
    ORDER BY year ASC, month ASC
  `).all();

  return Response.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
