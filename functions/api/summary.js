export async function onRequestGet(ctx) {
  const { results } = await ctx.env.DB.prepare(`
    SELECT
      substr(entry_date, 1, 7) AS month,
      SUM(COALESCE(rain_mm, 0)) AS rain_mm_total,
      SUM(COALESCE(bore_litres, 0)) AS bore_litres_total
    FROM entries
    GROUP BY month
    ORDER BY month ASC
  `).all();

  return Response.json(results);
}
