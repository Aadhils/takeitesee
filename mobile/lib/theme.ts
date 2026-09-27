export const theme = {
  colors: {
    canvas: '#F8F7FF',
    surface: '#FFFFFF',
    surfaceRaised: '#F8F7FF',
    surfaceMuted: '#EDF2FF',
    ink: '#101A34',
    inkMuted: '#5E6983',
    border: '#DFE6F2',
    primary: '#6352D9',
    primaryHover: '#5140C2',
    primaryStrong: '#2D2D9A',
    secondary: '#F2EFFF',
    accent: '#8F7AFF',
    selected: '#EEE9FF',
    success: '#237B5E',
    successSurface: '#ECF8F3',
    warning: '#9D6A1A',
    warningSurface: '#FFF8E7',
    danger: '#C54A4A',
    dangerSurface: '#FFF1F1',
    white: '#FFFFFF',
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
} as const;

export const cardShadow = {
  shadowColor: '#1D1C36',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
} as const;
