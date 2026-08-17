import { useState } from 'react';
import { Button, FieldError, Input, Label, ListBox, ListBoxItem, Select, TextField } from '@heroui/react';
import Modal from '@/shared/components/Modal';
import InlineError from '@/shared/components/InlineError';
import ProjectSelect from '@/modules/template/components/ProjectSelect';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { templateApi } from '@/modules/template/api/api';
import { environmentApi, projectApi } from '@/modules/template/api/projects';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Template } from '@quantum/contracts/modules/template/domain';

const copy = errorCopy(templateErrorMessages);

const NO_ENVIRONMENT = '__none__';

const inputTypeOf = (type: string): string => {
    if(type === 'number') return 'number';
    if(type === 'secret') return 'password';
    return 'text';
};

interface InstallTemplateDialogProps{
    template: Template | null;
    onClose: () => void;
    onInstalled: () => void;
}

const InstallTemplateDialog = ({ template, onClose, onInstalled }: InstallTemplateDialogProps) => {
    const organizationId = useCurrentOrganizationId();
    const projects = useQuery(projectApi.listByOrganization, [organizationId ?? undefined], { enabled: template !== null });
    const [projectId, setProjectId] = useState<number | null>(null);
    const environments = useQuery(environmentApi.list, [projectId ?? undefined], { enabled: projectId !== null });
    const [environmentId, setEnvironmentId] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [inputs, setInputs] = useState<Record<string, string | number | boolean>>({});

    const install = useMutation((targetProjectId: number, body: { name: string; environmentId: number | null; inputs: Record<string, string | number | boolean> }) =>
        templateApi.install(targetProjectId, {
            templateId: template?.id ?? 0,
            name: body.name,
            environmentId: body.environmentId,
            inputs: body.inputs
        }));

    const fields = (template?.inputsSchema ?? []).filter((def) => !def.generate);

    const selectProject = (id: number) => {
        setProjectId(id);
        setEnvironmentId(null);
    };

    const setInput = (key: string, value: string | number | boolean) => {
        setInputs((previous) => ({ ...previous, [key]: value }));
    };

    const valueOf = (key: string, fallback: string | number | boolean | undefined): string =>
        inputs[key] !== undefined ? String(inputs[key]) : fallback !== undefined ? String(fallback) : '';

    const handleInstall = async () => {
        if(projectId === null || name.trim() === '') return;

        const installed = await install
            .run(projectId, { name: name.trim(), environmentId, inputs })
            .then(() => true, () => false);

        if(!installed) return;
        onInstalled();
    };

    return (
        <Modal
            isOpen={template !== null}
            onOpenChange={(isOpen) => { if(!isOpen && !install.loading) onClose(); }}
            title={template === null ? 'Install template' : `Install ${template.name}`}
        >
            <div className='flex flex-col gap-4'>
                <TextField
                    value={name}
                    onChange={setName}
                    isDisabled={install.loading}
                    validationBehavior='aria'
                    fullWidth
                >
                    <Label>Name</Label>
                    <Input placeholder='my-service' autoComplete='off' />
                </TextField>

                <div className='flex flex-col gap-1.5'>
                    <Label>Project</Label>
                    <ProjectSelect
                        projects={projects.data ?? []}
                        value={projectId}
                        onChange={selectProject}
                        isDisabled={install.loading || projects.loading}
                    />
                </div>

                {projectId !== null && (
                    <div className='flex flex-col gap-1.5'>
                        <Label>Environment</Label>
                        <Select
                            aria-label='Environment'
                            selectedKey={environmentId ?? NO_ENVIRONMENT}
                            isDisabled={install.loading || environments.loading}
                            onSelectionChange={(key) => setEnvironmentId(key === NO_ENVIRONMENT ? null : Number(key))}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>

                            <Select.Popover>
                                <ListBox>
                                    <ListBoxItem id={NO_ENVIRONMENT} textValue='None'>None</ListBoxItem>
                                    {(environments.data ?? []).map((environment) => (
                                        <ListBoxItem key={environment.id} id={environment.id} textValue={environment.name}>
                                            {environment.name}
                                        </ListBoxItem>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>
                )}

                {fields.map((def) => (
                    <TextField
                        key={def.key}
                        type={inputTypeOf(def.type)}
                        value={valueOf(def.key, def.default)}
                        onChange={(value) => setInput(def.key, def.type === 'number' ? Number(value) : value)}
                        isDisabled={install.loading}
                        isRequired={def.required}
                        validationBehavior='aria'
                        fullWidth
                    >
                        <Label>{def.label}</Label>
                        <Input autoComplete='off' />
                        <FieldError />
                    </TextField>
                ))}

                {install.error !== undefined && <InlineError>{copy(install.error)}</InlineError>}

                <div className='flex justify-end gap-2'>
                    <Button variant='secondary' isDisabled={install.loading} onPress={onClose}>Cancel</Button>
                    <Button
                        isPending={install.loading}
                        isDisabled={projectId === null || name.trim() === ''}
                        onPress={() => { void handleInstall(); }}
                    >
                        Install
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default InstallTemplateDialog;
