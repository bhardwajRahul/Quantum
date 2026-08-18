import { useCallback, useEffect, useMemo, useState } from 'react';
import { Rocket, Boxes } from 'lucide-react';
import { templates } from '@services/platform/service';
import { PageHeader, EmptyState, Pill, Button, Card, CardContent } from '@components/atoms/kit';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useTenancy } from '@hooks/common';
import { truncate } from '@utilities/common/truncate';
import { unwrapList } from '@utilities/api/unwrap';
import InstallModal from './InstallModal';

const categoryLabel = (entry) => {
    if(!entry) return '';
    if(typeof entry === 'string') return entry;
    return entry.name || entry.label || entry.slug || '';
};

const ALL_CATEGORIES = '__all__';

const Templates = () => {
    const { projectId, hasProject } = useTenancy();

    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
    const [dialogTemplate, setDialogTemplate] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const [listRes, catRes] = await Promise.allSettled([
            templates.list({}),
            templates.categories({})
        ]);
        const ok = (r) => r.status === 'fulfilled' ? unwrapList(r.value) : [];
        setCatalog(ok(listRes));
        setCategories(ok(catRes));
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

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

    return (
        <div>
            <PageHeader
                title='Templates'
                subtitle='One-click deploy databases, apps and services from the marketplace. Your deployments appear under Applications.'
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
                </div>
            )}

            {dialogTemplate && (
                <InstallModal template={dialogTemplate} projectId={projectId} onClose={() => setDialogTemplate(null)} />
            )}
        </div>
    );
};

export default Templates;
