import { describe, expect, it } from 'vitest';
import { BUTTON_CONTRAST_PAIRS, DARK_SURFACE_BUTTON_PAIRS, FOCUS_INDICATOR_PAIRS, contrastRatio } from './contrast';

describe('shared button contrast tokens', () => {
  it('meets WCAG AA normal text contrast on enabled and disabled surfaces', () => {
    for (const pair of Object.values(BUTTON_CONTRAST_PAIRS)) {
      expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(pair.foreground, pair.hover)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(pair.disabledForeground, pair.disabled)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps white icon strokes readable when icons inherit button currentColor', () => {
    for (const variant of ['primary', 'danger'] as const) {
      const pair = BUTTON_CONTRAST_PAIRS[variant];
      expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps keyboard focus indicators distinct on light and dark surfaces', () => {
    for (const pair of FOCUS_INDICATOR_PAIRS) expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(3);
  });
  it('keeps every button variant legible on a dark forest panel', () => {
    for (const pair of DARK_SURFACE_BUTTON_PAIRS) expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(4.5);
  });
});
