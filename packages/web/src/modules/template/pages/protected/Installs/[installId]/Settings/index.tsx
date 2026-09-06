import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Input, Label, TextField } from '@heroui/react';
import SettingsSection from '@/shared/components/SettingsSection';
import EntitySelect from '@/shared/components/EntitySelect';
import ErrorState from '@/shared/components/ErrorState';
import CenterState from '@/shared/components/CenterState';
import SaveStatus from '@/shared/components/forms/SaveStatus';
import EnvironmentVariablesEditor from '@/shared/components/EnvironmentVariablesEditor';
import { FieldsSkeleton } from '@/shared/components/skeletons';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useAutosave } from '@/shared/hooks/forms/use-autosave';
import { templateInstallApi } from '@/modules/template/api/api';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { StackDeployTrigger, StackSource, TemplateInstall } from '@quantum/contracts/modules/template/domain';
import type { UpdateStackSourceInput } from '@quantum/contracts/modules/template/http';

const copy = errorCopy(templateErrorMessages);

const TRIGGERS: Array<{ key: StackDeployTrigger; label: (branch: string) => string }> = [
    { key: 'push', label: (branch) => `Every push to ${branch}` },
    { key: 'release', label: () => 'Every published release' }
];

interface SourceSectionProps{
    installId: number;
    source: StackSource;
}

const SourceSection = ({ installId, source }: SourceSectionProps) => {
    const [form, setForm] = useState<UpdateStackSourceInput>({ branch: source.branch, composePath: source.composePath, deployOn: source.deployOn });
    const saver = useAutosave<UpdateStackSourceInput>({
        value: form,
        canSave: (value) => value.branch.trim() !== '' && value.composePath.trim() !== '',
        save: async (value) => {
            await templateInstallApi.updateSource({ path: { id: installId }, body: value });
        }
    });

    return (
        <SettingsSection title='Source' description='Where the compose file comes from. Changes apply on the next deploy.'>
            <div className='flex flex-wrap items-center justify-between gap-4'>
                <a
                    href={`https://github.com/${source.owner}/${source.repo}`}
                    target='_blank'
                    rel='noreferrer'
                    className='font-mono text-[0.8125rem] text-foreground underline-offset-4 hover:underline'
                >
                    {source.owner}/{source.repo}
                </a>
                <SaveStatus state={saver.state} />
            </div>

            <TextField value={form.branch} onChange={(branch) => setForm((current) => ({ ...current, branch }))} validationBehavior='aria' fullWidth>
                <Label>Branch</Label>
                <Input className='font-mono' autoComplete='off' />
            </TextField>

            <TextField value={form.composePath} onChange={(composePath) => setForm((current) => ({ ...current, composePath }))} validationBehavior='aria' fullWidth>
                <Label>Compose file</Label>
                <Input className='font-mono' autoComplete='off' />
            </TextField>

            <div className='flex flex-col gap-1.5'>
                <Label>Deploy on</Label>
                <EntitySelect
                    items={TRIGGERS}
                    getKey={(entry) => entry.key}
                    getLabel={(entry) => entry.label(form.branch)}
                    value={form.deployOn}
                    onChange={(key) => setForm((current) => ({ ...current, deployOn: key as StackDeployTrigger }))}
                    ariaLabel='Deploy on'
                />
            </div>
        </SettingsSection>
    );
};

const InstallSettings = () => {
    const { installId } = useParams<{ installId: string }>();
    const id = installId !== undefined ? Number(installId) : undefined;
    const install = useOutletContext<TemplateInstall>();
    const variables = useQuery((templateInstallId: number) => templateInstallApi.variables({ path: { id: templateInstallId } }), [id]);

    if(id === undefined || install.compose === null) return null;

    return (
        <div className='flex flex-col gap-10 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0'>
            {install.source !== null && <SourceSection installId={id} source={install.source} />}

            {variables.loading && <FieldsSkeleton rows={2} />}

            {variables.error !== undefined && (
                <CenterState>
                    <ErrorState title='Could not load the variables' description={copy(variables.error)} onRetry={variables.reload} />
                </CenterState>
            )}

            {!variables.loading && variables.error === undefined && (
                <EnvironmentVariablesEditor
                    title='Variables'
                    variables={variables.data ?? {}}
                    save={(next) => templateInstallApi.updateVariables({ path: { id }, body: { variables: next } })}
                    getErrorMessage={copy}
                    description='Values for the ${VAR} placeholders in the compose file. Saved automatically, applied on the next deploy.'
                    emptyDescription='The compose file uses no ${VAR} placeholders yet, or none needs a value.'
                    fills={false}
                />
            )}
        </div>
    );
};

export default InstallSettings;
