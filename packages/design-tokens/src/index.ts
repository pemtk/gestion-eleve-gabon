/** Jetons Classical pour React Native (équivalent de tokens.css). Le filet est un noir à 16 %. */
export const colors = {
  bg: '#f3f2f2',
  surface: '#eae9e9',
  text: '#201f1d',
  accent: '#b68235',
  divider: 'rgba(32,31,29,0.16)',
  neutral: {
    100: '#f8f4f4', 200: '#eae7e7', 300: '#d7d3d3', 400: '#bab6b6', 500: '#9b9797',
    600: '#7d7979', 700: '#605d5d', 800: '#444141', 900: '#2d2b2b',
  },
  accentRamp: {
    100: '#fff3e4', 200: '#ffe3bf', 300: '#facb8d', 400: '#e1ad66', 500: '#c28d41',
    600: '#a06f24', 700: '#7d5411', 800: '#5a3b0a', 900: '#3a270d',
  },
} as const;

export const radius = { sm: 2, md: 4, lg: 7 } as const;

export const fonts = {
  heading: 'CormorantGaramond_400Regular',
  headingItalic: 'CormorantGaramond_400Regular_Italic',
  headingSemi: 'CormorantGaramond_600SemiBold',
  body: 'Lora_400Regular',
  bodyItalic: 'Lora_400Regular_Italic',
  bodySemi: 'Lora_600SemiBold',
} as const;

export type Colors = typeof colors;
