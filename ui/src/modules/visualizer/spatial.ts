/**
 * A uniform grid over points - finds what is near a position without looking at every node (hover, clicks and
 * keyboard navigation have to stay instant with thousands of nodes). Rebuilding it is a linear pass.
 */
export class SpatialGrid {
  private cell = 48;
  private minX = 0;
  private minY = 0;
  private cols = 1;
  private rows = 1;
  private starts = new Int32Array(2);
  private items = new Int32Array(0);

  /** The grid never has more than this many cells per axis, however far the points are apart. */
  static readonly MAX_CELLS_PER_AXIS = 400;

  rebuild(x: ArrayLike<number>, y: ArrayLike<number>, count: number, preferredCell = 48): void {
    if (count === 0) {
      this.cols = 1;
      this.rows = 1;
      this.starts = new Int32Array(2);
      this.items = new Int32Array(0);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < count; i++) {
      if (x[i] < minX) minX = x[i];
      if (x[i] > maxX) maxX = x[i];
      if (y[i] < minY) minY = y[i];
      if (y[i] > maxY) maxY = y[i];
    }
    const limit = SpatialGrid.MAX_CELLS_PER_AXIS;
    this.cell = Math.max(preferredCell, (maxX - minX) / limit, (maxY - minY) / limit, 1e-6);
    this.minX = minX;
    this.minY = minY;
    this.cols = Math.floor((maxX - minX) / this.cell) + 1;
    this.rows = Math.floor((maxY - minY) / this.cell) + 1;

    const starts = new Int32Array(this.cols * this.rows + 1);
    const cellOf = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      const c = Math.floor((y[i] - minY) / this.cell) * this.cols + Math.floor((x[i] - minX) / this.cell);
      cellOf[i] = c;
      starts[c + 1]++;
    }
    for (let c = 0; c < this.cols * this.rows; c++) {
      starts[c + 1] += starts[c];
    }
    const cursor = starts.slice(0, this.cols * this.rows);
    const items = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      items[cursor[cellOf[i]]++] = i;
    }
    this.starts = starts;
    this.items = items;
  }

  /** Calls `visit` with every point which may be within `range` of the position (the caller does the exact test). */
  forEachNear(px: number, py: number, range: number, visit: (index: number) => void): void {
    const c0 = Math.floor((px - range - this.minX) / this.cell);
    const c1 = Math.floor((px + range - this.minX) / this.cell);
    const r0 = Math.floor((py - range - this.minY) / this.cell);
    const r1 = Math.floor((py + range - this.minY) / this.cell);
    if (c1 < 0 || c0 > this.cols - 1 || r1 < 0 || r0 > this.rows - 1) {
      return;
    }
    const colFrom = Math.max(0, c0);
    const colTo = Math.min(this.cols - 1, c1);
    for (let row = Math.max(0, r0); row <= Math.min(this.rows - 1, r1); row++) {
      for (let col = colFrom; col <= colTo; col++) {
        const c = row * this.cols + col;
        for (let i = this.starts[c]; i < this.starts[c + 1]; i++) {
          visit(this.items[i]);
        }
      }
    }
  }
}
