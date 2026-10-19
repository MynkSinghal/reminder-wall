// Local calendar for the wallpaper and dashboard: weekday + day of year in IST,
// so the edge server's UTC clock never shows yesterday before 5:30am.
export const TZ = "Asia/Kolkata";

export function calendar(now: Date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "long" })
      .formatToParts(now).map(x => [x.type, x.value]),
  );
  const y = +p.year;
  const t = Date.UTC(y, +p.month - 1, +p.day);
  const dayOfYear  = Math.round((t - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  return { weekday: p.weekday, dayOfYear, daysInYear };
}
