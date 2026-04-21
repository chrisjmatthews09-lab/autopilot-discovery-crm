// Warm palette with indigo primary — authoritative. One source of truth for colors, fonts, spacing.
// Primary is the Autopilot Accounting logo indigo; `success` stays green so
// "interested/enriched/resolved" status pills keep their semantic tone even
// though the primary is no longer green.
//
// The `COLORS` object includes a handful of legacy aliases (card, cardAlt,
// blue, gold, etc.) kept so the ~200 existing `style={{ background: COLORS.card }}`
// call sites continue to work. New code should prefer the semantic names
// (surface, bgMuted, accent, error, etc.) and those aliases can be retired
// opportunistically.

export const COLORS = {
  // Core warm palette (authoritative)
  bg: '#F8F6F1',
  bgMuted: '#F1EEE7',
  surface: '#FFFFFF',
  primary: '#3A47B8',
  primaryHover: '#2D3894',
  primaryLight: '#EBEDF8',
  accent: '#C4552D',
  accentHover: '#A3461F',
  accentLight: '#FAEDE6',
  text: '#2A2520',
  textMuted: '#635E55',
  border: '#D9D3C7',
  borderLight: '#E8E4DB',
  error: '#B04521',
  success: '#1A5C3A',
  warning: '#D97706',

  // ── Legacy aliases ───────────────────────────────────────────────────────
  // Kept so existing style prop references resolve. Migrate opportunistically.
  card: '#FFFFFF',                 // → surface
  cardAlt: '#FDFCF9',              // slightly warmer than bgMuted; used for subtle panels
  sidebar: '#FDFCF9',              // sidebar background — warm off-white
  textDim: '#78716C',              // dimmer variant used in a few dim-text spots
  borderDark: '#C7C0B0',           // used for focus rings / dividers
  danger: '#B04521',               // → error
  // Secondary accents that existed in the App.jsx inline palette. Kept warm-
  // tinted so the overall tone stays consistent even where these still appear.
  blue: '#2563A0',
  blueLight: '#EBF3FC',
  purple: '#6B4FA0',
  purpleLight: '#F3EFFE',
  gold: '#9A7B2C',
  goldLight: '#FBF6E8',
};

// Fonts — kept as strings for compatibility with existing
// `style={{ fontFamily: FONT }}` usage. `FONT_FAMILIES` exposes the same
// values in the object form recommended for new code.
export const FONT = `'Karla', 'Nunito Sans', sans-serif`;
export const DISPLAY = `'Fraunces', 'Playfair Display', serif`;
export const FONT_FAMILIES = {
  heading: DISPLAY,
  body: FONT,
  mono: "'JetBrains Mono', Menlo, monospace",
};

export const RADII = { sm: 6, md: 8, lg: 10, xl: 14, pill: 999 };
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const SHADOWS = {
  sm: '0 1px 2px rgba(42, 37, 32, 0.04)',
  md: '0 2px 8px rgba(42, 37, 32, 0.08)',
  lg: '0 8px 24px rgba(42, 37, 32, 0.12)',
};

export const BREAKPOINT_MOBILE = 768;
export const SIDEBAR_WIDTH = 220;
export const TOPBAR_HEIGHT = 52;
export const MOBILE_NAV_HEIGHT = 60;
