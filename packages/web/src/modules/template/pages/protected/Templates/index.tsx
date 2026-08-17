import { useState } from 'react';
import { Button, ListBox, ListBoxItem, Select } from '@heroui/react';
import { Boxes, Plus } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import InstallTemplateDialog from '@/modules/template/components/InstallTemplateDialog';
import { useQuery } from '@/shared/hooks/api/use-query';
import { templateApi } from '@/modules/template/api/api';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Template } from '@quantum/contracts/modules/template/domain';

const copy = errorCopy(templateErrorMessages);

const ALL_CATEGORIES = '__all__';

interface TemplatesHeaderProps{
    categories: string[];
    category: string | null;
    onCategoryChange: (category: string | null) => void;
}

const TemplatesHeader = ({ categories, category, onCategoryChange }: TemplatesHeaderProps) => (
    <div className='flex items-center justify-between gap-4'>
        <div>
            <h1 className='text-lg font-medium text-foreground'>Templates</h1>
            <p className='mt-1.5 text-sm text-muted'>Install a pre-configured service into one of your projects.</p>
        </div>

        {categories.length > 0 && (
            <div className='w-48'>
                <Select
                    aria-label='Category'
                    selectedKey={category ?? ALL_CATEGORIES}
                    onSelectionChange={(key) => onCategoryChange(key === ALL_CATEGORIES ? null : String(key))}
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>

                    <Select.Popover>
                        <ListBox>
                            <ListBoxItem id={ALL_CATEGORIES} textValue='All categories'>All categories</ListBoxItem>
                            {categories.map((item) => (
                                <ListBoxItem key={item} id={item} textValue={item}>{item}</ListBoxItem>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            </div>
        )}
    </div>
);

interface TemplateCardProps{
    template: Template;
    onInstall: () => void;
}

const TemplateCard = ({ template, onInstall }: TemplateCardProps) => (
    <div className='flex flex-col gap-3 rounded-xl border border-border p-5'>
        <div className='flex items-center justify-between gap-3'>
            <span className='font-medium text-foreground'>{template.name}</span>
            <span className='text-[0.75rem] text-muted'>{template.category}</span>
        </div>

        {template.description && <p className='text-[0.875rem] text-muted'>{template.description}</p>}

        <div className='mt-1'>
            <Button size='sm' onPress={onInstall}>
                <Plus aria-hidden='true' className='size-4' />
                Install
            </Button>
        </div>
    </div>
);

const Templates = () => {
    const [category, setCategory] = useState<string | null>(null);
    const categories = useQuery(templateApi.categories, []);
    const templates = useQuery(templateApi.list, []);
    const [installTarget, setInstallTarget] = useState<Template | null>(null);

    if(templates.loading) return <LoadingState title='Loading templates' compact />;
    if(templates.error !== undefined){
        return (
            <ErrorState
                title='Could not load templates'
                description={copy(templates.error)}
                onRetry={templates.reload}
            />
        );
    }

    const items = (templates.data ?? []).filter((template) => category === null || template.category === category);

    return (
        <PageBody width='wide'>
            <TemplatesHeader
                categories={categories.data ?? []}
                category={category}
                onCategoryChange={setCategory}
            />

            <div className='mt-6'>
                {items.length === 0 ? (
                    <EmptyState
                        icon={Boxes}
                        title='No templates yet'
                        description='There are no templates available for this filter.'
                    />
                ) : (
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                        {items.map((template) => (
                            <TemplateCard
                                key={template.id}
                                template={template}
                                onInstall={() => setInstallTarget(template)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <InstallTemplateDialog
                key={installTarget?.id ?? 'install'}
                template={installTarget}
                onClose={() => setInstallTarget(null)}
                onInstalled={() => setInstallTarget(null)}
            />
        </PageBody>
    );
};

export default Templates;
