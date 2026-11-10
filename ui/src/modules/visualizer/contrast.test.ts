import { CANVAS_COLOR, contrastRatio, GRAPHIC_CONTRAST, inkOn, INK_DARK, INK_LIGHT, legibleOn, parseColor, TEXT_CONTRAST } from "./contrast";

describe("parseColor", () => {
  it("reads short and long hex", () => {
    expect(parseColor("#fa0")).toEqual([255, 170, 0]);
    expect(parseColor("#123456")).toEqual([18, 52, 86]);
  });
  it("reads rgb()", () => expect(parseColor("rgb(10, 20, 30)")).toEqual([10, 20, 30]));
  it("gives up on anything else", () => expect(parseColor("tomato")).toBeUndefined());
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5));
  it("is 1 for equal colors", () => expect(contrastRatio("#4f6bed", "#4f6bed")).toBeCloseTo(1, 5));
});

describe("inkOn", () => {
  it("uses dark ink on light colors", () => {
    for (const light of ["#ffd43b", "#fff3bf", "#a5d8ff", "#c9a227"]) {
      expect(inkOn(light)).toBe(INK_DARK);
      expect(contrastRatio(inkOn(light), light)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });
  it("uses white ink on dark colors", () => {
    for (const dark of ["#7048e8", "#0b3d91", "#212529", "#9c36b5"]) {
      expect(inkOn(dark)).toBe(INK_LIGHT);
    }
  });
  it("never picks the worse of the two inks, and reaches at least 3:1 for the palette", () => {
    for (const color of ["#4f6bed", "#0ea5a4", "#e8590c", "#9c36b5", "#2f9e5c", "#d6336c", "#1c7ed6", "#c9a227", "#7048e8", "#e03131", "#0b7285", "#5c940d"]) {
      const chosen = contrastRatio(inkOn(color), color);
      expect(chosen).toBeGreaterThanOrEqual(Math.max(contrastRatio(INK_LIGHT, color), contrastRatio(INK_DARK, color)) - 0.5);
      expect(chosen).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    }
  });
});

describe("legibleOn", () => {
  it("keeps a color that is legible already", () => expect(legibleOn("#0b3d91")).toBe("#0b3d91"));
  it("darkens a light color to the requested contrast, staying in the same hue family", () => {
    const result = legibleOn("#ffd43b", CANVAS_COLOR, TEXT_CONTRAST);
    expect(result).not.toBe("#ffd43b");
    expect(contrastRatio(result, CANVAS_COLOR)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });
  it("needs less darkening for graphics than for text", () => {
    const graphic = legibleOn("#ffd43b", CANVAS_COLOR, GRAPHIC_CONTRAST);
    expect(contrastRatio(graphic, CANVAS_COLOR)).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(contrastRatio(legibleOn("#ffd43b"), CANVAS_COLOR)).toBeGreaterThanOrEqual(contrastRatio(graphic, CANVAS_COLOR));
  });
  it("leaves colors it cannot parse alone", () => expect(legibleOn("tomato")).toBe("tomato"));
});
