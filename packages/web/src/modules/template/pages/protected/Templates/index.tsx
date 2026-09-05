import { useMemo, useState } from 'react';
import { Input, Label, ListBox, ListBoxItem, Select, TextField } from '@heroui/react';
import { Boxes, Search } from 'lucide-react';
import ListPageShell from '@/shared/components/ListPageShell';
import EmptyState from '@/shared/components/EmptyState';
import InstallTemplateDialog from '@/modules/template/components/InstallTemplateDialog';
import TemplateDetail from '@/modules/template/components/TemplateDetail';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useResource } from '@/shared/hooks/api/use-resource';
import { templateRoutes } from '@quantum/contracts/modules/template/routes';
import { templateApi } from '@/modules/template/api/api';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Template } from '@quantum/contracts/modules/template/domain';

const copy = errorCopy(templateErrorMessages);

const ALL_CATEGORIES = '__all__';

interface CatalogueRowProps{
    template: Template;
    isSelected: boolean;
    onSelect: () => void;
}

/**
 * Name and description, nothing else. The row used to repeat the icon, version and
 * category that the detail pane states properly a few pixels to the right — three
 * badges of noise on every line, in a list whose only job is letting the reader pick
 * one thing to read about.
 */
const CatalogueRow = ({ template, isSelected, onSelect }: CatalogueRowProps) => (
    <button
        type='button'
        onClick={onSelect}
        aria-current={isSelected}
        className={`flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
            isSelected ? 'bg-foreground/[0.08]' : 'hover:bg-foreground/[0.04]'
        }`}
    >
        <span className='truncate text-[0.875rem] font-medium text-foreground'>{template.name}</span>

        <span className='line-clamp-2 text-[0.8125rem] text-muted'>
            {template.description ?? 'No description provided.'}
        </span>
    </button>
);

interface CatalogueProps{
    templates: Template[];
    categories: string[];
    category: string | null;
    onCategoryChange: (category: string | null) => void;
    search: string;
    onSearchChange: (search: string) => void;
    selectedId: number | null;
    onSelect: (template: Template) => void;
}

const Catalogue = ({
    templates, categories, category, onCategoryChange, search, onSearchChange, selectedId, onSelect
}: CatalogueProps) => (
    <div className='flex min-h-0 w-full shrink-0 flex-col gap-3 border-b border-border p-3 lg:h-full lg:w-[22rem] lg:border-b-0 lg:border-r'>
        <TextField value={search} onChange={onSearchChange} validationBehavior='aria' fullWidth>
            <Label className='sr-only'>Search templates</Label>
            <Input placeholder='Search templates…' autoComplete='off' />
        </TextField>

        {categories.length > 0 && (
            <Select
                aria-label='Category'
                selectedKey={category ?? ALL_CATEGORIES}
                onSelectionChange={(key) => onCategoryChange(key === ALL_CATEGORIES ? null : String(key))}
                fullWidth
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
        )}

        <div className='min-h-0 flex-1 overflow-y-auto'>
            {templates.length === 0 ? (
                <EmptyState icon={Search} title='No matches' description='Try a different search or category.' compact />
            ) : (
                <div className='flex flex-col gap-1'>
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
    const [category, setCategory] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Template | null>(null);
    const [installTarget, setInstallTarget] = useState<Template | null>(null);

    const categories = useQuery(templateApi.categories, []);
    const templates = useResource(templateRoutes, { list: 'list' });

    const needle = search.trim().toLowerCase();
    const visible = useMemo(() => (templates.data ?? []).filter((template) => {
        if(category !== null && template.category !== category) return false;
        if(needle === '') return true;

        return `${template.name} ${template.slug} ${template.description ?? ''}`.toLowerCase().includes(needle);
    }), [templates.data, category, needle]);

    /*
     * The detail pane follows the list: whatever is highlighted is what is described. A
     * selection that the current filter has hidden would leave the two panes disagreeing,
     * so it falls back to the first match.
     */
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

    /*
     * Deliberately outside `PageBody`: this is the one page that wants the whole width
     * rather than a centred column, and the negative inset cancels the padding the
     * dashboard's main region applies to every other page. Each pane scrolls on its own
     * so the page itself never does.
     */
    return (
        <div className='-mx-4 flex h-full min-h-0 flex-col lg:flex-row'>
            <Catalogue
                templates={visible}
                categories={categories.data ?? []}
                category={category}
                onCategoryChange={setCategory}
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
