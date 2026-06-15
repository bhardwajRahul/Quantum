/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Rocket, Boxes, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { templates, templateInstalls } from '@services/platform/service';
import { PageHeader, StatusBadge, EmptyState, DataTable, Pill, Button, Card, CardContent } from '@components/atoms/kit';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import useTenancy from '@hooks/common/useTenancy';
import { formatAbsoluteDate } from '@utilities/common/dateUtils';
import { truncate } from '@utilities/common/truncate';
import InstallModal from './InstallModal';

/** Normalise a category entry (string or { name } object) into a plain label. */
const categoryLabel = (entry) => {
    if(!entry) return '';
    if(typeof entry === 'string') return entry;
    return entry.name || entry.label || entry.slug || '';
};

// Statuses that mean the install is still in flight — drives the polling loop.
const TRANSIENT = ['queued', 'pending', 'provisioning', 'installing', 'building'];
const isTransient = (status) => {
    const s = (status || '').toLowerCase();
    return TRANSIENT.some((x) => s.includes(x));
};

const ALL_CATEGORIES = '__all__';

const INSTALL_COLUMNS = [
    { key: 'name', header: 'Name' },
    { key: 'template', header: 'Template' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created', header: 'Created' }
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Templates = () => {
    const { projectId, hasProject } = useTenancy();

    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState([]);
    const [installs, setInstalls] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
    const [dialogTemplate, setDialogTemplate] = useState(null);
    const [uninstallTarget, setUninstallTarget] = useState(null);
    const [uninstalling, setUninstalling] = useState(false);

    const refreshInstalls = useCallback(() => {
        if(!projectId){ setInstalls([]); return; }
        templateInstalls.listByProject({ query: { params: { projectId } } })
            .then((res) => setInstalls(Array.isArray(res?.data) ? res.data : []))
            .catch(() => {});
    }, [projectId]);

    const load = useCallback(async () => {
        setLoading(true);
        // Each call is independent and any may legitimately be empty/unseeded.
        // The catalog + categories are global; installs are project-scoped.
        const [listRes, catRes, installRes] = await Promise.allSettled([
            templates.list({}),
            templates.categories({}),
            hasProject ? templateInstalls.listByProject({ query: { params: { projectId } } }) : Promise.resolve(null)
        ]);
        if(listRes.status === 'fulfilled'){
            setCatalog(Array.isArray(listRes.value?.data) ? listRes.value.data : []);
        }
        if(catRes.status === 'fulfilled'){
            setCategories(Array.isArray(catRes.value?.data) ? catRes.value.data : []);
        }
        if(hasProject && installRes.status === 'fulfilled'){
            setInstalls(Array.isArray(installRes.value?.data) ? installRes.value.data : []);
        }else{
            setInstalls([]);
        }
        setLoading(false);
    }, [hasProject, projectId]);

    useEffect(() => { load(); }, [load]);

    // Install-status polling: while any install is still in flight, refetch the
    // project's installs every 5s. Cleared on unmount / when nothing is transient.
    const anyTransient = installs.some((i) => isTransient(i.status));
    useEffect(() => {
        if(!hasProject || !anyTransient) return undefined;
        const interval = setInterval(() => { refreshInstalls(); }, 5000);
        return () => clearInterval(interval);
    }, [hasProject, anyTransient, refreshInstalls]);

    const handleDialogClose = () => {
        setDialogTemplate(null);
        refreshInstalls();
    };

    const handleUninstall = async () => {
        if(!uninstallTarget) return;
        setUninstalling(true);
        try{
            await templateInstalls.remove({ query: { params: { id: uninstallTarget._id || uninstallTarget.id } } });
            setUninstallTarget(null);
            toast.success('Install removed.');
            refreshInstalls();
        }catch(err){
            toast.error(typeof err === 'string' ? err : (err?.message || 'Failed to uninstall.'));
        }finally{
            setUninstalling(false);
        }
    };

    // Build the category dropdown items from the categories endpoint, falling
    // back to whatever categories appear on the catalog entries themselves.
    const categoryItems = useMemo(() => {
        const labels = new Set();
        categories.forEach((c) => { const l = categoryLabel(c); if(l) labels.add(l); });
        catalog.forEach((t) => { if(t.category) labels.add(t.category); });
        return [ALL_CATEGORIES, ...Array.from(labels).sort()];
    }, [categories, catalog]);

    const filteredCatalog = useMemo(() => {
        if(activeCategory === ALL_CATEGORIES) return catalog;
        return catalog.filter((t) => t.category === activeCategory);
    }, [catalog, activeCategory]);

    const installRows = installs.map((install) => ({
        id: String(install._id || install.id || install.name),
        name: install.name,
        template: install.templateName || install.template?.name || '—',
        status: install.status || 'unknown',
        created: formatAbsoluteDate(install.createdAt, '—'),
        _install: install
    }));

    return (
        <div>
            <PageHeader
                title='Templates'
                subtitle='One-click deploy databases, apps and services from the marketplace.'
            />

            {!hasProject && (
                <p className='mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary'>
                    Browse the catalog below. Installing a template requires selecting a project first.
                </p>
            )}

            {loading ? (
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {[0, 1, 2].map((i) => (
                        <Card key={i}>
                            <CardContent className='p-5'>
                                <div className='h-5 w-2/3 rounded bg-muted animate-pulse' />
                                <div className='mt-3 h-3 w-full rounded bg-muted animate-pulse' />
                                <div className='mt-2 h-3 w-5/6 rounded bg-muted animate-pulse' />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : catalog.length === 0 ? (
                <EmptyState
                    icon={Boxes}
                    title='No templates yet'
                    body='The template marketplace will populate here once the catalog is seeded. Soon you will be able to one-click deploy databases, apps and services.'
                />
            ) : (
                <div className='flex flex-col gap-8'>
                    {categoryItems.length > 1 && (
                        <div className='max-w-xs space-y-1.5'>
                            <label className='text-sm font-medium'>Filter by category</label>
                            <Select value={activeCategory} onValueChange={(value) => setActiveCategory(value || ALL_CATEGORIES)}>
                                <SelectTrigger><SelectValue placeholder='Filter by category' /></SelectTrigger>
                                <SelectContent>
                                    {categoryItems.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item === ALL_CATEGORIES ? 'All categories' : item}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                        {filteredCatalog.map((template) => (
                            <Card
                                key={template._id || template.id || template.name}
                                className='h-full'
                            >
                                <CardContent className='flex flex-col h-full p-5'>
                                    <div className='flex items-start justify-between'>
                                        <span className='grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary'>
                                            <Boxes className='h-5 w-5' />
                                        </span>
                                        {template.category && (
                                            <Pill tone='gray'>{template.category}</Pill>
                                        )}
                                    </div>
                                    <h5 className='mt-4 text-lg font-semibold text-foreground'>
                                        {template.name}
                                    </h5>
                                    <p className='mt-2 flex-1 text-sm text-muted-foreground'>
                                        {truncate(template.description)}
                                    </p>
                                    <div className='mt-4'>
                                        <Button
                                            variant='outline'
                                            size='sm'
                                            onClick={() => setDialogTemplate(template)}
                                        >
                                            <Rocket className='h-4 w-4' /> Deploy
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {installs.length > 0 && (
                        <div>
                            <h5 className='mb-3 text-lg font-semibold text-foreground'>Your installs</h5>
                            <DataTable
                                columns={INSTALL_COLUMNS}
                                rows={installRows}
                                actions={(row) => (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant='ghost' size='icon'>
                                                <MoreVertical className='h-4 w-4' />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align='end'>
                                            <DropdownMenuItem className='text-destructive' onClick={() => setUninstallTarget(row._install)}>
                                                <Trash2 className='h-4 w-4' /> Uninstall
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            />
                        </div>
                    )}
                </div>
            )}

            {dialogTemplate && (
                <InstallModal template={dialogTemplate} projectId={projectId} onClose={handleDialogClose} onInstalled={refreshInstalls} />
            )}

            {/* Uninstall-confirm modal. */}
            <Dialog open={!!uninstallTarget} onOpenChange={(o) => { if(!o && !uninstalling) setUninstallTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Uninstall</DialogTitle>
                        <DialogDescription>
                            This removes <strong className='text-foreground'>{uninstallTarget?.name}</strong> and its provisioned resources. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => !uninstalling && setUninstallTarget(null)}>Cancel</Button>
                        <Button variant='destructive' onClick={handleUninstall} disabled={uninstalling}>
                            {uninstalling ? 'Uninstalling…' : 'Uninstall'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Templates;
