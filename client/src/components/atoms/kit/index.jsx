/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * Shared UI kit — reuse-first building blocks composed on the shadcn/ui
 * primitives (Creative Tim UI). Centralizes page headers, KPI/stat cards,
 * status badges, the data table, empty states and copy-to-clipboard so every
 * page is consistent and the status→tone mapping lives in ONE place.
 ****/

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* PageHeader — title + subtitle + optional actions                    */
/* ------------------------------------------------------------------ */
export const PageHeader = ({ title, subtitle, actions }) => (
    <div className='flex flex-wrap items-start justify-between gap-4 mb-8'>
        <div className='space-y-1'>
            <h1 className='text-xl font-semibold tracking-tight text-foreground'>{title}</h1>
            {subtitle && <p className='text-sm text-muted-foreground'>{subtitle}</p>}
        </div>
        {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
    </div>
);

/* ------------------------------------------------------------------ */
/* Status → tone. Single source of truth for the whole platform.       */
/* Vercel-style: a small colored dot + colored text. No pill, no       */
/* background, no border — one coherent cue, not four.                 */
/* ------------------------------------------------------------------ */
const TONES = {
    green: 'text-success',
    amber: 'text-warning',
    red: 'text-destructive',
    violet: 'text-primary',
    gray: 'text-muted-foreground'
};
const DOTS = {
    green: 'bg-success', amber: 'bg-warning', red: 'bg-destructive', violet: 'bg-primary', gray: 'bg-muted-foreground'
};

const statusTone = (status) => {
    const s = String(status || '').toLowerCase();
    if(['running', 'success', 'active', 'healthy', 'succeeded', 'up', 'online', 'ready', 'enabled', 'completed'].some((x) => s.includes(x))) return 'green';
    if(['building', 'queued', 'provisioning', 'pending', 'deploying', 'reloading', 'creating', 'installing', 'restarting', 'backing-up', 'restoring', 'issuing'].some((x) => s.includes(x))) return 'amber';
    if(['failure', 'error', 'failed', 'crash', 'exited', 'unhealthy'].some((x) => s.includes(x))) return 'red';
    if(['stopped', 'removed', 'rolledback', 'revoked', 'disabled', 'paused'].some((x) => s.includes(x))) return 'gray';
    return 'gray';
};

export const StatusBadge = ({ status, tone }) => {
    const t = tone || statusTone(status);
    return (
        <span className={cn('inline-flex items-center gap-2 text-sm', TONES[t])}>
            <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[t])} />
            {status || 'unknown'}
        </span>
    );
};

/* A quiet text label for non-status tags (engine, type, count). */
export const Pill = ({ children }) => (
    <span className='inline-flex items-center text-xs text-muted-foreground'>
        {children}
    </span>
);

/* ------------------------------------------------------------------ */
/* StatCard — flat KPI: label + big value. No box, no icon chip.       */
/* ------------------------------------------------------------------ */
export const StatCard = ({ label, value, hint, trend }) => (
    <div className='py-1'>
        <p className='text-sm text-muted-foreground'>{label}</p>
        <div className='mt-1 flex items-end gap-2'>
            <span className='text-3xl font-semibold tracking-tight text-foreground tabular-nums'>{value}</span>
            {trend && (
                <span className={cn('mb-1.5 text-xs font-medium', trend.startsWith('-') ? 'text-destructive' : 'text-success')}>
                    {trend}
                </span>
            )}
        </div>
        {hint && <p className='mt-0.5 text-xs text-muted-foreground'>{hint}</p>}
    </div>
);

/* ------------------------------------------------------------------ */
/* EmptyState — plain centered icon + title + body + action. No box.   */
/* ------------------------------------------------------------------ */
export const EmptyState = ({ icon: Icon, title, body, action }) => (
    <div className='flex flex-col items-center text-center py-20 px-6'>
        {Icon && <Icon className='mb-4 h-7 w-7 text-muted-foreground' strokeWidth={1.5} />}
        <h3 className='text-base font-medium text-foreground'>{title}</h3>
        {body && <p className='mt-1.5 max-w-md text-sm text-muted-foreground'>{body}</p>}
        {action && <div className='mt-6'>{action}</div>}
    </div>
);

/* ------------------------------------------------------------------ */
/* DataTable — flat table; hairline row dividers only, no outer box.   */
/* columns: [{ key, header, align?, render?(row) }]                    */
/* rows: [{ id, ... }]; actions?(row); onRowClick?(row)                */
/* ------------------------------------------------------------------ */
export const DataTable = ({ columns, rows, actions, onRowClick, getRowKey, emptyText = 'No records.' }) => (
    <div className='w-full overflow-x-auto'>
        <table className='w-full caption-bottom text-sm'>
            <thead>
                <tr className='border-b border-border'>
                    {columns.map((col) => (
                        <th
                            key={col.key}
                            className={cn('h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground/70', col.align === 'right' && 'text-right')}
                        >
                            {col.header}
                        </th>
                    ))}
                    {actions && <th className='w-12' />}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length + (actions ? 1 : 0)} className='h-24 text-center text-sm text-muted-foreground'>
                            {emptyText}
                        </td>
                    </tr>
                ) : rows.map((row, i) => (
                    <tr
                        key={getRowKey ? getRowKey(row) : (row.id ?? i)}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        className={cn(
                            'border-b border-border/50 transition-colors',
                            onRowClick && 'cursor-pointer hover:bg-muted/40'
                        )}
                    >
                        {columns.map((col, ci) => (
                            <td
                                key={col.key}
                                className={cn('px-3 py-3 align-middle', ci === 0 && 'font-medium text-foreground', col.align === 'right' && 'text-right')}
                            >
                                {col.render ? col.render(row) : row[col.key]}
                            </td>
                        ))}
                        {actions && (
                            <td className='px-3 py-3 text-right align-middle' onClick={(e) => e.stopPropagation()}>
                                {actions(row)}
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

/* ------------------------------------------------------------------ */
/* CopyInline — monospace value + copy button                          */
/* ------------------------------------------------------------------ */
export const CopyInline = ({ value }) => {
    const [copied, setCopied] = useState(false);
    if(!value || value === '—') return <span className='text-muted-foreground'>—</span>;
    const copy = () => {
        try{
            navigator.clipboard.writeText(String(value));
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }catch{ /* clipboard unavailable */ }
    };
    return (
        <span className='inline-flex items-center gap-1.5 max-w-full'>
            <span className='font-mono text-xs truncate'>{value}</span>
            <button type='button' onClick={copy} className='shrink-0 text-muted-foreground hover:text-primary transition-colors' aria-label='Copy'>
                {copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
            </button>
        </span>
    );
};

/* Loading helpers. */
export const LoadingBlock = ({ label = 'Loading' }) => (
    <div className='grid place-items-center py-20 text-sm text-muted-foreground'>{label}…</div>
);

export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
    <Card className='p-4 space-y-3'>
        {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className='flex gap-4'>
                {Array.from({ length: cols }).map((_, c) => (
                    <Skeleton key={c} className='h-6 flex-1' />
                ))}
            </div>
        ))}
    </Card>
);

export { Button, Badge, Card, CardContent };
