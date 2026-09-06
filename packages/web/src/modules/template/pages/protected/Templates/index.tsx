import { useMemo, useState } from 'react';
import { Input, Label, TextField } from '@heroui/react';
import { Boxes, Search } from 'lucide-react';
import ListPageShell from '@/shared/components/ListPageShell';
import EmptyState from '@/shared/components/EmptyState';
import InstallTemplateDialog from '@/modules/template/components/InstallTemplateDialog';
import TemplateDetail from '@/modules/template/components/TemplateDetail';
import { useResource } from '@/shared/hooks/api/use-resource';
import { templateRoutes } from '@quantum/contracts/modules/template/routes';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Template } from '@quantum/contracts/modules/template/domain';

const copy = errorCopy(templateErrorMessages);

interface CatalogueRowProps{
    template: Template;
    isSelected: boolean;
    onSelect: () => void;
}

const CatalogueRow = ({ template, isSelected, onSelect }: CatalogueRowProps) => (
    <button
        type='button'
        onClick={onSelect}
        aria-current={isSelected}
        className={`flex w-full items-center justify-between gap-4 border-b border-separator py-3 text-left transition-colors focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none ${
            isSelected ? 'text-foreground' : 'text-muted hover:text-foreground'
        }`}
    >
        <span className='truncate text-sm'>{template.name}</span>
    </button>
);

interface CatalogueProps{
    templates: Template[];
    search: string;
    onSearchChange: (search: string) => void;
    selectedId: number | null;
    onSelect: (template: Template) => void;
}

const Catalogue = ({ templates, search, onSearchChange, selectedId, onSelect }: CatalogueProps) => (
    <div className='flex min-h-0 w-full shrink-0 flex-col gap-4 border-b border-border pb-6 pl-5 pr-5 pt-8 lg:h-full lg:w-[24rem] lg:border-b-0 lg:border-r lg:pt-9'>
        <p className='label-caps text-muted'>
            Catalogue · {templates.length} {templates.length === 1 ? 'template' : 'templates'}
        </p>

        <TextField value={search} onChange={onSearchChange} validationBehavior='aria' fullWidth>
            <Label className='sr-only'>Search templates</Label>
            <Input placeholder='Search templates…' autoComplete='off' />
        </TextField>

        <div className='min-h-0 flex-1 overflow-y-auto'>
            {templates.length === 0 ? (
                <EmptyState icon={Search} title='No matches' description='Try a different search.' compact />
            ) : (
                <div className='flex flex-col'>
                    {templates.map((template) => (
                        <CatalogueRow
                            key={template.id}
                            template={template}
                            isSelected={template.id === selectedId}
                            onSelect={() => onSelect(template)}
                        />
                    ))}
                </div>
            )}
        </div>
    </div>
);

const Templates = () => {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Template | null>(null);
    const [installTarget, setInstallTarget] = useState<Template | null>(null);

    const templates = useResource(templateRoutes, { list: 'list' });

    const needle = search.trim().toLowerCase();
    const visible = useMemo(() => (templates.data ?? []).filter((template) => {
        if(needle === '') return true;

        return `${template.name} ${template.slug} ${template.description ?? ''}`.toLowerCase().includes(needle);
    }), [templates.data, needle]);

    const shown = visible.find((template) => template.id === selected?.id) ?? visible[0] ?? null;

    if(templates.loading || templates.error !== undefined){
        return (
            <ListPageShell
                fill
                loading={templates.loading}
                loadingTitle='Loading templates'
                error={templates.error}
                errorTitle='Could not load templates'
                getErrorDescription={copy}
                onRetry={templates.refresh}
            />
        );
    }

    return (
        <div className='flex h-full min-h-0 flex-col lg:flex-row'>
            <Catalogue
                templates={visible}
                search={search}
                onSearchChange={setSearch}
                selectedId={shown?.id ?? null}
                onSelect={setSelected}
            />

            <div className='min-h-0 flex-1'>
                {shown === null ? (
                    <div className='flex h-full items-center justify-center'>
                        <EmptyState
                            icon={Boxes}
                            title='No templates available'
                            description='Templates you can install into a project will appear here.'
                        />
                    </div>
                ) : (
                    <TemplateDetail template={shown} onInstall={() => setInstallTarget(shown)} />
                )}
            </div>

            <InstallTemplateDialog
                key={installTarget?.id ?? 'install'}
                template={installTarget}
                onClose={() => setInstallTarget(null)}
                onInstalled={templates.refresh}
            />
        </div>
    );
};

export default Templates;
