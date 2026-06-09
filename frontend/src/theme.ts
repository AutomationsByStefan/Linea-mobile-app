export const Colors = {
  background: '#FDFCF8',
  primary: '#A68B5B',
  primaryHover: '#8B7349',
  gradientStart: '#C4A574',
  gradientEnd: '#A68B5B',
  foreground: '#2C2C2C',
  muted: '#888888',
  border: 'rgba(229, 211, 179, 0.5)',
  cardBg: '#FFFFFF',
  secondary: '#F5E6D3',
  inputBorder: '#E8E2D8',
  white: '#FFFFFF',
  black: '#000000',
  danger: '#DC3545',
  success: '#28A745',
  warning: '#FFA500',
};

export const Fonts = {
  heading: 'PlayfairDisplay_700Bold',
  headingRegular: 'PlayfairDisplay_400Regular',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemiBold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
};

export const Sizes = {
  h1: 32,
  h2: 24,
  h3: 20,
  body: 16,
  small: 14,
  tiny: 12,
  xs: 10,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const CardStyle = {
  backgroundColor: Colors.cardBg,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 24,
  padding: 24,
  shadowColor: 'rgba(166, 139, 91, 0.1)',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 20,
  elevation: 4,
};

export const BosnianDays = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
export const BosnianDaysShort = ['NED', 'PON', 'UTO', 'SRI', 'ČET', 'PET', 'SUB'];

/**
 * Parse a date string in either YYYY-MM-DD (ISO, optionally with a time part)
 * or DD.MM.YYYY(.) form into a Date at LOCAL midnight. Returns null if it can't
 * be parsed. Building the Date from explicit components avoids the UTC-midnight
 * off-by-one that `new Date("2026-06-05")` causes in negative timezones.
 */
export function parseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  // ISO: 2026-06-05 (with optional Thh:mm... suffix)
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // European: 05.06.2026
  m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Combine a date string (either format) with an HH:MM time into a Date.
 * When the time is missing/unparseable it falls back to end-of-day, so a
 * training counts as "completed" only once its whole day has passed.
 */
export function toDateTime(dateStr?: string | null, timeStr?: string | null): Date | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  const m = String(timeStr ?? '').match(/^(\d{1,2}):(\d{2})/);
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  else d.setHours(23, 59, 59, 0);
  return d;
}

/**
 * Convert a date typed in DD.MM.YYYY (or already in YYYY-MM-DD) form into the
 * YYYY-MM-DD string the backend expects. Returns null if it can't be parsed,
 * so callers can show an error instead of sending garbage.
 */
export function toISODate(dateStr?: string | null): string | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** DD.MM.YYYY format used everywhere */
export function formatDD(dateStr: string): string {
  if (!dateStr) return '-';
  const d = parseDate(dateStr);
  if (!d) return String(dateStr).slice(0, 10);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
}

/** Whole days from today until the given date. Negative if the date is in the past. */
export function daysUntil(dateStr: string): number | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/** "Petak, 06.06.2026." — weekday + DD.MM.YYYY */
export function formatDateWithDay(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return `${BosnianDays[d.getDay()]}, ${formatDD(dateStr)}`;
}
