/** Fuseau d'affichage des heures de messagerie (Libreville). */
const TZ = 'Africa/Libreville';

/** Libellé d'heure d'une conversation : l'heure aujourd'hui, « Hier », le jour dans la semaine, sinon la date. */
export function timeLabel(at: Date, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString('fr-CA', { timeZone: TZ });
  if (day(at) === day(now))
    return at.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TZ,
    });
  const days = Math.round(
    (Date.parse(day(now)) - Date.parse(day(at))) / 86_400_000,
  );
  if (days === 1) return 'Hier';
  if (days < 7)
    return at
      .toLocaleDateString('fr-FR', { weekday: 'short', timeZone: TZ })
      .replace(/^./, (c) => c.toUpperCase());
  return at.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TZ,
  });
}
