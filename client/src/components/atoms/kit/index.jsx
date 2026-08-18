import { Fragment, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Check, Copy, Loader2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PageHeader = ({ title, subtitle, actions }) => (
    <div className='flex flex-wrap items-start justify-between gap-4 mb-8'>
        <div className='space-y-1'>
            <h1 className='text-xl font-semibold tracking-tight text-foreground'>{title}</h1>
            {subtitle && <p className='text-sm text-muted-foreground'>{subtitle}</p>}
        </div>
        {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
    </div>
);

const TONE = {
    green:  { text: 'text-success',          dot: 'bg-success' },
    amber:  { text: 'text-warning',          dot: 'bg-warning' },
    red:    { text: 'text-destructive',      dot: 'bg-destructive' },
    violet: { text: 'text-primary',          dot: 'bg-primary' },
    gray:   { text: 'text-muted-foreground', dot: 'bg-muted-foreground' }
};
const toneOf = (t) => TONE[t] || TONE.gray;

const STATUS_GROUPS = [
    ['green', ['running', 'success', 'active', 'healthy', 'succeeded', 'up', 'online', 'ready', 'enabled', 'completed']],
    ['amber', ['building', 'queued', 'provisioning', 'pending', 'deploying', 'reloading', 'creating', 'installing', 'restarting', 'backing-up', 'restoring', 'issuing']],
    ['red',   ['failure', 'error', 'failed', 'crash', 'exited', 'unhealthy']],
    ['gray',  ['stopped', 'removed', 'rolledback', 'revoked', 'disabled', 'paused']]
];
const statusTone = (status) => {
    const s = String(status || '').toLowerCase();
    const match = STATUS_GROUPS.find(([, words]) => words.some((w) => s.includes(w)));
    return match ? match[0] : 'gray';
};

export const StatusBadge = ({ status, tone }) => {
    const t = toneOf(tone || statusTone(status));
    return (
        <span className={cn('inline-flex items-center gap-2 text-sm', t.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
            {status || 'unknown'}
        </span>
    );
};

export const Pill = ({ children, tone = 'gray' }) => (
    <span className={cn('inline-flex items-center text-xs', toneOf(tone).text)}>
        {children}
    </span>
);

export const StatCard = ({ label, value, hint }) => (
    <div className='py-1'>
        <p className='text-sm text-muted-foreground'>{label}</p>
        <div className='mt-1 flex items-end gap-2'>
            <span className='text-3xl font-semibold tracking-tight text-foreground tabular-nums'>{value}</span>
        </div>
        {hint && <p className='mt-0.5 text-xs text-muted-foreground'>{hint}</p>}
    </div>
);

export const EmptyState = ({ icon: Icon, title, body, action }) => (
    <div className='flex flex-col items-center text-center py-20 px-6'>
        {Icon && <Icon className='mb-4 h-7 w-7 text-muted-foreground' strokeWidth={1.5} />}
        <h3 className='text-base font-medium text-foreground'>{title}</h3>
        {body && <p className='mt-1.5 max-w-md text-sm text-muted-foreground'>{body}</p>}
        {action && <div className='mt-6'>{action}</div>}
    </div>
);

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

export const CopyInline = ({ value }) => {
    const [copied, setCopied] = useState(false);
    if(!value || value === '—') return <span className='text-muted-foreground'>—</span>;
    const copy = () => {
        try{
            navigator.clipboard.writeText(String(value));
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }catch{   }
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

export const LoadingBlock = ({ label = 'Loading' }) => (
    <div className='grid place-items-center py-20 text-sm text-muted-foreground'>{label}…</div>
);

export const LoadingScreen = ({ minHeight = '100vh' }) => (
    <div style={{ display: 'grid', placeItems: 'center', minHeight }}>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
    </div>
);

export const BusyOverlay = ({ show, message }) => {
    if(!show) return null;
    return (
        <div className='fixed inset-0 z-[9999] grid place-items-center bg-background/60 backdrop-blur-sm'>
            <div className='flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-4 shadow-xl'>
                <Loader2 className='h-5 w-5 animate-spin text-primary' />
                <span className='text-sm text-foreground'>{message}</span>
            </div>
        </div>
    );
};

export const RowActionsMenu = ({ items }) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' aria-label='Actions'>
                <MoreVertical className='h-4 w-4' />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
            {items.map((item, i) => {
                const Icon = item.icon;
                return (
                    <Fragment key={item.label || i}>
                        {item.separatorBefore && i > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                            className={cn(item.danger && 'text-destructive')}
                            disabled={item.disabled}
                            onClick={item.onClick}
                        >
                            {Icon && <Icon className='h-4 w-4' />} {item.label}
                        </DropdownMenuItem>
                    </Fragment>
                );
            })}
        </DropdownMenuContent>
    </DropdownMenu>
);

export const ConfirmDialog = ({
    open,
    onCancel,
    onConfirm,
    title,
    description,
    confirmLabel,
    pendingLabel,
    pending = false,
    destructive = false
}) => (
    <Dialog open={open} onOpenChange={(o) => { if(!o && !pending) onCancel(); }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <DialogFooter>
                <Button variant='outline' onClick={() => !pending && onCancel()}>Cancel</Button>
                <Button
                    variant={destructive ? 'destructive' : 'default'}
                    onClick={onConfirm}
                    disabled={pending}
                >
                    {pending ? pendingLabel : confirmLabel}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

export { Button, Card, CardContent };
