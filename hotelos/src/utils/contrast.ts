export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const values = hex.replace('#', '').match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const a = luminance(foreground); const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Effective shared-button colors from the HotelOS design token palette. */
export const BUTTON_CONTRAST_PAIRS = {
  primary: { foreground: '#FFFFFF', background: '#17251F', hover: '#243A30', disabledForeground: '#FFFFFF', disabled: '#65716A' },
  secondary: { foreground: '#17251F', background: '#F5F2EC', hover: '#FFFFFF', disabledForeground: '#65716A', disabled: '#F5F2EC' },
  accent: { foreground: '#17251F', background: '#C4A574', hover: '#C4A574', disabledForeground: '#17251F', disabled: '#E7E3DA' },
  ghost: { foreground: '#17251F', background: '#FFFFFF', hover: '#F5F2EC', disabledForeground: '#65716A', disabled: '#F5F2EC' },
  danger: { foreground: '#FFFFFF', background: '#A83E38', hover: '#A83E38', disabledForeground: '#FFFFFF', disabled: '#65716A' },
} as const;

/** Focus outline pairings: dark outline for light surfaces and champagne ring for dark surfaces. */
export const FOCUS_INDICATOR_PAIRS = [
  { foreground: '#17251F', background: '#FFFFFF' },
  { foreground: '#C4A574', background: '#17251F' },
] as const;

export const DARK_SURFACE_BUTTON_PAIRS = [
  { variant: 'primary', foreground: '#17251F', background: '#C4A574' },
  { variant: 'secondary', foreground: '#17251F', background: '#F5F2EC' },
  { variant: 'accent', foreground: '#17251F', background: '#C4A574' },
  { variant: 'ghost', foreground: '#FFFFFF', background: '#17251F' },
  { variant: 'danger', foreground: '#FFFFFF', background: '#A83E38' },
] as const;
