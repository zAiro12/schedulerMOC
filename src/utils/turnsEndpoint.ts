// Centralizza il path dell'endpoint per i turni. Fornisce helper per costruire URL dinamico.
export const TURNS_PATH = '/getTurni';

function formatDateYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getTurnsUrl(baseUrl: string, from: Date, to: Date) {
  const base = baseUrl.replace(/\/$/, '');
  const fromS = formatDateYMD(from);
  const toS = formatDateYMD(to);
  return `${base}${TURNS_PATH}?from=${fromS}&to=${toS}`;
}

export default { TURNS_PATH, getTurnsUrl };
