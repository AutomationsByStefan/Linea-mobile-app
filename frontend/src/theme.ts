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
export const BosnianMonths = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];

export function formatDateBosnian(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = BosnianDays[d.getDay()];
  const num = d.getDate();
  const month = BosnianMonths[d.getMonth()];
  return `${day}, ${num}. ${month}`;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
}

/** DD.MM.YYYY format used everywhere */
export function formatDD(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
}
