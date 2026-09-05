/**
 * One place for the axis and grid styling every chart shares, so a second chart cannot
 * drift from the first. Axis lines and ticks are dropped entirely and the grid is a
 * horizontal hairline mixed from the foreground — the data is what should carry the ink.
 */
export const GRID_STROKE = 'color-mix(in oklab, var(--foreground) 6%, transparent)';

export const TICK = { fontSize: 12, fill: 'var(--muted)' } as const;

export const AXIS = { axisLine: false, tickLine: false, tick: TICK } as const;

export const CURSOR = { fill: GRID_STROKE } as const;
