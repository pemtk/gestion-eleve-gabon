/** Jour d'aujourd'hui à Libreville (UTC+1), au format AAAA-MM-JJ. */
export const todayIso = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
