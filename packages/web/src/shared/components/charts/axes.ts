export const GRID_STROKE = 'color-mix(in oklab, var(--foreground) 6%, transparent)';

export const TICK = { fontSize: 12, fill: 'var(--muted)' } as const;

export const AXIS = { axisLine: false, tickLine: false, tick: TICK } as const;

export const CURSOR = { fill: GRID_STROKE } as const;
