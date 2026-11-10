import type { ColorKey } from '../types';

export const COLORS: Record<ColorKey, { label: string; hex: string }> = {
  blue: { label: 'Blu', hex: '#4f8ff7' },
  purple: { label: 'Viola', hex: '#9b7bf7' },
  pink: { label: 'Rosa', hex: '#ec6cb9' },
  red: { label: 'Rosso', hex: '#f0645f' },
  orange: { label: 'Arancione', hex: '#f59a4c' },
  yellow: { label: 'Giallo', hex: '#e7c14b' },
  green: { label: 'Verde', hex: '#4cc38a' },
  teal: { label: 'Turchese', hex: '#3cc2c9' },
  gray: { label: 'Grigio', hex: '#9a9a9a' },
};

export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];

export const colorHex = (k: ColorKey | null | undefined) => COLORS[k ?? 'blue']?.hex ?? COLORS.blue.hex;
