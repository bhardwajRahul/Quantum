/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

import { useState, useEffect, useCallback } from 'react';
import { Plus, FolderKanban, Bell, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, StatusBadge, EmptyState, DataTable, LoadingBlock, Button } from '@components/atoms/kit';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { alertChannels, alertRules } from '@services/platform/service';
import useTenancy from '@hooks/common/useTenancy';
import { errText } from '@utilities/common/errText';

const CHANNEL_TYPES = [
    { value: 'email', label: 'Email' },
    { value: 'webhook', label: 'Webhook' }
];

const RULE_EVENTS = [
    'deployment.failed',
    'health.unhealthy',
    'container.crashed',
    'metrics.cpu',
    'metrics.mem'
];

const channelTarget = (channel) =>
    channel?.config?.email || channel?.config?.url || '—';

const channelLabel = (channel) =>
    `${channel?.type || 'channel'} · ${channelTarget(channel)}`;

const CHANNEL_COLUMNS = [
    { key: 'type', header: 'Type' },
    { key: 'target', header: 'Target' },
    { key: 'enabled', header: 'Enabled', render: (row) => <StatusBadge status={row.enabled} /> }
];

const RULE_COLUMNS = [
    { key: 'event', header: 'Event' },
    { key: 'threshold', header: 'Threshold' },
    { key: 'channel', header: 'Channel' },
    { key: 'enabled', header: 'Enabled', render: (row) => <StatusBadge status={row.enabled} /> }
];

/**
 * Alerting — per-project alert configuration split across two tabs:
 *   - Channels: where notifications are delivered (email / webhook).
 *   - Rules:    which events fire, optionally gated by a metric threshold,
 *               routed to a channel.
 * Both collections are project-scoped; we reload them whenever the selected
 * project changes. Creates are queued server-side (202) — we refetch after.
 */
const Alerting = () => {
    const { projectId, hasProject } = useTenancy();

    const [channels, setChannels] = useState([]);
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Channel create modal.
    const [channelOpen, setChannelOpen] = useState(false);
    const [channelType, setChannelType] = useState('email');
    const [channelEmail, setChannelEmail] = useState('');
    const [channelUrl, setChannelUrl] = useState('');
    const [channelSecret, setChannelSecret] = useState('');
    const [channelEnabled, setChannelEnabled] = useState(true);
    const [channelSubmitting, setChannelSubmitting] = useState(false);
    const [channelError, setChannelError] = useState(null);

    // Rule create modal.
    const [ruleOpen, setRuleOpen] = useState(false);
    const [ruleEvent, setRuleEvent] = useState(RULE_EVENTS[0]);
    const [ruleThreshold, setRuleThreshold] = useState(80);
    const [ruleChannel, setRuleChannel] = useState('');
    const [ruleEnabled, setRuleEnabled] = useState(true);
    const [ruleSubmitting, setRuleSubmitting] = useState(false);
    const [ruleError, setRuleError] = useState(null);

    // Delete-confirm (shared across both tabs).
    const [deleteTarget, setDeleteTarget] = useState(null); // { kind, item }
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        if(!projectId) return;
        setLoading(true);
        setError(null);
        try{
            const [chRes, rlRes] = await Promise.all([
                alertChannels.listByProject({ query: { params: { projectId } } }),
                alertRules.listByProject({ query: { params: { projectId } } })
            ]);
            setChannels(chRes?.data || []);
            setRules(rlRes?.data || []);
        }catch(err){
            setError(errText(err, 'Failed to load alerting configuration.'));
        }finally{
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const isMetricEvent = ruleEvent.startsWith('metrics.');

    const openChannelModal = () => {
        setChannelType('email');
        setChannelEmail('');
        setChannelUrl('');
        setChannelSecret('');
        setChannelEnabled(true);
        setChannelError(null);
        setChannelOpen(true);
    };

    const openRuleModal = () => {
        setRuleEvent(RULE_EVENTS[0]);
        setRuleThreshold(80);
        setRuleChannel(channels[0]?._id || '');
        setRuleEnabled(true);
        setRuleError(null);
        setRuleOpen(true);
    };

    const handleCreateChannel = async () => {
        const isEmail = channelType === 'email';
        if(isEmail && !channelEmail.trim()) return;
        if(!isEmail && !channelUrl.trim()) return;
        setChannelSubmitting(true);
        setChannelError(null);
        try{
            await alertChannels.createInProject({
                query: { params: { projectId } },
                body: {
                    type: channelType,
                    config: isEmail
                        ? { email: channelEmail.trim() }
                        : { url: channelUrl.trim() },
                    ...(!isEmail && channelSecret.trim() ? { secret: channelSecret.trim() } : {}),
                    enabled: channelEnabled
                }
            });
            setChannelOpen(false);
            toast.success('Channel created.');
            await load();
        }catch(err){
            setChannelError(errText(err, 'Failed to create channel.'));
        }finally{
            setChannelSubmitting(false);
        }
    };

    const handleCreateRule = async () => {
        if(!ruleChannel) return;
        setRuleSubmitting(true);
        setRuleError(null);
        try{
            await alertRules.createInProject({
                query: { params: { projectId } },
                body: {
                    event: ruleEvent,
                    ...(isMetricEvent && ruleThreshold !== '' && ruleThreshold != null
                        ? { threshold: Number(ruleThreshold) } : {}),
                    channel: ruleChannel,
                    enabled: ruleEnabled
                }
            });
            setRuleOpen(false);
            toast.success('Rule created.');
            await load();
        }catch(err){
            setRuleError(errText(err, 'Failed to create rule.'));
        }finally{
            setRuleSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if(!deleteTarget) return;
        setDeleting(true);
        try{
            const api = deleteTarget.kind === 'channel' ? alertChannels : alertRules;
            await api.remove({ query: { params: { id: deleteTarget.item._id } } });
            const kind = deleteTarget.kind;
            setDeleteTarget(null);
            toast.success(`${kind === 'channel' ? 'Channel' : 'Rule'} deleted.`);
            await load();
        }catch(err){
            toast.error(errText(err, 'Delete failed.'));
        }finally{
            setDeleting(false);
        }
    };

    if(!hasProject){
        return (
            <div>
                <PageHeader title='Alerting' subtitle='Configure alert channels and rules for your project.' />
                <EmptyState
                    icon={FolderKanban}
                    title='Select a project'
                    body='Alerting is configured per project. Pick or create a project to manage alert channels and rules.'
                />
            </div>
        );
    }

    const channelRows = channels.map((c) => ({
        id: String(c._id),
        type: c.type || 'unknown',
        target: channelTarget(c),
        enabled: c.enabled ? 'enabled' : 'disabled',
        _item: c
    }));

    const rulesById = channels.reduce((acc, c) => { acc[String(c._id)] = c; return acc; }, {});
    const ruleRows = rules.map((r) => {
        const ch = rulesById[String(r.channel)];
        return {
            id: String(r._id),
            event: r.event || '—',
            threshold: (r.threshold === undefined || r.threshold === null) ? '—' : String(r.threshold),
            channel: ch ? channelLabel(ch) : (r.channel ? String(r.channel) : '—'),
            enabled: r.enabled ? 'enabled' : 'disabled',
            _item: r
        };
    });

    const rowMenu = (kind, item) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon'>
                    <MoreVertical className='h-4 w-4' />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuItem className='text-destructive' onClick={() => setDeleteTarget({ kind, item })}>
                    <Trash2 className='h-4 w-4' /> Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div>
            <PageHeader title='Alerting' subtitle='Configure alert channels and rules for your project.' />

            {error && (
                <p className='mb-4 text-sm text-destructive'>{error}</p>
            )}

            {/* Channel create modal. */}
            <Dialog open={channelOpen} onOpenChange={(o) => { if(!o && !channelSubmitting) setChannelOpen(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New channel</DialogTitle>
                    </DialogHeader>
                    <div className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Type</label>
                            <Select value={channelType} onValueChange={(value) => setChannelType(value)}>
                                <SelectTrigger><SelectValue placeholder='Type' /></SelectTrigger>
                                <SelectContent>
                                    {CHANNEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {channelType === 'email' ? (
                            <div className='space-y-1.5'>
                                <label className='text-sm font-medium'>Email address</label>
                                <Input
                                    type='email'
                                    placeholder='alerts@example.com'
                                    value={channelEmail}
                                    onChange={(e) => setChannelEmail(e.target.value)}
                                />
                            </div>
                        ) : (
                            <>
                                <div className='space-y-1.5'>
                                    <label className='text-sm font-medium'>Webhook URL</label>
                                    <Input
                                        placeholder='https://hooks.example.com/…'
                                        value={channelUrl}
                                        onChange={(e) => setChannelUrl(e.target.value)}
                                    />
                                </div>
                                <div className='space-y-1.5'>
                                    <label className='text-sm font-medium'>Signing secret (optional)</label>
                                    <Input
                                        type='password'
                                        value={channelSecret}
                                        onChange={(e) => setChannelSecret(e.target.value)}
                                    />
                                    <p className='text-xs text-muted-foreground'>
                                        Used to HMAC-sign payloads. Stored encrypted and never shown again.
                                    </p>
                                </div>
                            </>
                        )}
                        <label className='flex items-center gap-2 text-sm font-medium'>
                            <input
                                type='checkbox'
                                className='h-4 w-4 rounded border-border'
                                checked={channelEnabled}
                                onChange={(e) => setChannelEnabled(e.target.checked)}
                            />
                            Enabled
                        </label>
                        {channelError && (
                            <p className='text-sm text-destructive'>{channelError}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !channelSubmitting && setChannelOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleCreateChannel}
                            disabled={channelSubmitting || (channelType === 'email' ? !channelEmail.trim() : !channelUrl.trim())}
                        >
                            {channelSubmitting ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rule create modal. */}
            <Dialog open={ruleOpen} onOpenChange={(o) => { if(!o && !ruleSubmitting) setRuleOpen(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New rule</DialogTitle>
                    </DialogHeader>
                    <div className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Event</label>
                            <Select value={ruleEvent} onValueChange={(value) => setRuleEvent(value)}>
                                <SelectTrigger><SelectValue placeholder='Event' /></SelectTrigger>
                                <SelectContent>
                                    {RULE_EVENTS.map((ev) => <SelectItem key={ev} value={ev}>{ev}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {isMetricEvent && (
                            <div className='space-y-1.5'>
                                <label className='text-sm font-medium'>Threshold (%)</label>
                                <Input
                                    type='number'
                                    min={0}
                                    max={100}
                                    value={ruleThreshold}
                                    onChange={(e) => setRuleThreshold(e.target.value)}
                                />
                                <p className='text-xs text-muted-foreground'>
                                    Fire when the metric crosses this value.
                                </p>
                            </div>
                        )}
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Channel</label>
                            <Select value={ruleChannel} onValueChange={(value) => setRuleChannel(value)}>
                                <SelectTrigger><SelectValue placeholder='Channel' /></SelectTrigger>
                                <SelectContent>
                                    {channels.map((c) => (
                                        <SelectItem key={c._id} value={String(c._id)}>{channelLabel(c)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <label className='flex items-center gap-2 text-sm font-medium'>
                            <input
                                type='checkbox'
                                className='h-4 w-4 rounded border-border'
                                checked={ruleEnabled}
                                onChange={(e) => setRuleEnabled(e.target.checked)}
                            />
                            Enabled
                        </label>
                        {ruleError && (
                            <p className='text-sm text-destructive'>{ruleError}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !ruleSubmitting && setRuleOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleCreateRule}
                            disabled={ruleSubmitting || !ruleChannel}
                        >
                            {ruleSubmitting ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete-confirm modal. */}
            <Dialog open={!!deleteTarget} onOpenChange={(o) => { if(!o && !deleting) setDeleteTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{deleteTarget?.kind === 'channel' ? 'Delete channel' : 'Delete rule'}</DialogTitle>
                        <DialogDescription>
                            This permanently removes the {deleteTarget?.kind}. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !deleting && setDeleteTarget(null)}>Cancel</Button>
                        <Button variant='destructive' onClick={handleDelete} disabled={deleting}>
                            {deleting ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Tabs defaultValue='channels'>
                <TabsList>
                    <TabsTrigger value='channels'>Channels</TabsTrigger>
                    <TabsTrigger value='rules'>Rules</TabsTrigger>
                </TabsList>

                {/* CHANNELS */}
                <TabsContent value='channels'>
                    <div className='flex justify-end my-4'>
                        <Button onClick={openChannelModal}>
                            <Plus className='h-4 w-4' /> New channel
                        </Button>
                    </div>
                    {loading ? (
                        <LoadingBlock label='Loading channels' />
                    ) : channelRows.length === 0 ? (
                        <EmptyState
                            icon={Bell}
                            title='No channels yet'
                            body='Add an email or webhook channel to start receiving alerts.'
                            action={(
                                <Button onClick={openChannelModal}>
                                    <Plus className='h-4 w-4' /> New channel
                                </Button>
                            )}
                        />
                    ) : (
                        <DataTable
                            columns={CHANNEL_COLUMNS}
                            rows={channelRows}
                            actions={(row) => rowMenu('channel', row._item)}
                        />
                    )}
                </TabsContent>

                {/* RULES */}
                <TabsContent value='rules'>
                    <div className='flex items-center justify-end gap-3 my-4'>
                        {!loading && channels.length === 0 && (
                            <span className='text-xs text-muted-foreground'>
                                Create a channel first
                            </span>
                        )}
                        <Button
                            onClick={openRuleModal}
                            disabled={channels.length === 0}
                        >
                            <Plus className='h-4 w-4' /> New rule
                        </Button>
                    </div>
                    {loading ? (
                        <LoadingBlock label='Loading rules' />
                    ) : ruleRows.length === 0 ? (
                        <EmptyState
                            icon={Bell}
                            title='No rules yet'
                            body='Create a rule to route events like failed deployments or high CPU to a channel.'
                            action={(
                                <Button
                                    onClick={openRuleModal}
                                    disabled={channels.length === 0}
                                >
                                    <Plus className='h-4 w-4' /> New rule
                                </Button>
                            )}
                        />
                    ) : (
                        <DataTable
                            columns={RULE_COLUMNS}
                            rows={ruleRows}
                            actions={(row) => rowMenu('rule', row._item)}
                        />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Alerting;
