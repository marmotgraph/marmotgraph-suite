/**
 * Color contrast helpers (WCAG 2.x). The colors of the types are never altered for the fill of a node -
 * these helpers only pick the ink (text, outlines) that has to stay legible on top of, or next to, such a color.
 */

/** The surface of the graph canvas. */
export const CANVAS_COLOR = "#f7f8fb";
export const INK_LIGHT = "#ffffff";
export const INK_DARK = "#14181f";

/** WCAG AA: normal text, and graphical objects / large text. */
export const TEXT_CONTRAST = 4.5;
export const GRAPHIC_CONTRAST = 3;

type Rgb = [number, number, number];

/** Understands #rgb, #rrggbb and rgb()/rgba(); undefined for anything else (named colors, var(), ...). */
export function parseColor(color: string): Rgb | undefined {
  const value = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return [0, 2, 4].map((i) => Number.parseInt(digits.substring(i, i + 2), 16)) as Rgb;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(value);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((c) => Math.min(255, c)) as Rgb;
  }
  return undefined;
}

const toHex = (rgb: Rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

export function luminance(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) {
    return 0.2; // unknown notation: assume a mid tone
  }
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * White or near-black text for the given background: white while it is legible (AA), otherwise whichever
 * reads better. (Some mid tones reach AA with neither - then the better of the two is the best there is.)
 */
export function inkOn(background: string): string {
  const light = contrastRatio(INK_LIGHT, background);
  if (light >= TEXT_CONTRAST) {
    return INK_LIGHT;
  }
  return contrastRatio(INK_DARK, background) > light ? INK_DARK : INK_LIGHT;
}

/**
 * The color itself if it is legible against the background, otherwise the closest darker shade that is
 * (the hue stays recognisable, only the lightness drops).
 */
export function legibleOn(color: string, background: string = CANVAS_COLOR, minimum: number = TEXT_CONTRAST): string {
  const rgb = parseColor(color);
  if (!rgb || contrastRatio(color, background) >= minimum) {
    return color;
  }
  for (let amount = 0.05; amount <= 1; amount += 0.05) {
    const darker = toHex(rgb.map((c) => c * (1 - amount)) as Rgb);
    if (contrastRatio(darker, background) >= minimum) {
      return darker;
    }
  }
  return INK_DARK;
}
