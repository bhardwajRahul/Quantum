import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button, Input, Label, TextField } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import SettingsSection from '@/shared/components/SettingsSection';
import EntitySelect from '@/shared/components/EntitySelect';
import InlineError from '@/shared/components/InlineError';
import MonacoEditor from '@/shared/components/MonacoEditor';
import { useResource } from '@/shared/hooks/api/use-resource';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { templateInstallApi } from '@/modules/template/api/api';
import { projectRoutes } from '@quantum/contracts/modules/project/routes';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { composeErrorMessage } from '@/modules/template/utils/compose-error';
import { COMPOSE_STARTER } from '@/modules/template/utils/compose-starter';
import type { CreateComposeInstallInput } from '@quantum/contracts/modules/template/http';

const CreateCompose = () => {
    const navigate = useNavigate();
    const organizationId = useCurrentOrganizationId();
    const projects = useResource(projectRoutes, {
        list: 'listByOrganization',
        request: organizationId === null ? null : { path: { orgId: organizationId } }
    });
    const [projectId, setProjectId] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [compose, setCompose] = useState(COMPOSE_STARTER);
    const deploy = useMutation((targetProjectId: number, body: CreateComposeInstallInput) =>
        templateInstallApi.createCompose({ path: { projectId: targetProjectId }, body }));

    useEffect(() => {
        if(projectId !== null) return;
        const list = projects.data ?? [];
        const pick = list.find((project) => project.isDefault) ?? list[0];
        if(pick !== undefined) setProjectId(pick.id);
    }, [projectId, projects.data]);

    const ready = projectId !== null && name.trim() !== '' && compose.trim() !== '';

    const handleDeploy = async () => {
        if(projectId === null || !ready) return;

        const created = await deploy
            .run(projectId, { name: name.trim(), compose })
            .then(() => true, () => false);

        if(created) navigate(`/applications?project=${projectId}`);
    };

    return (
        <PageBody width='wide'>
            <PageHeader
                eyebrow='Applications'
                title='Deploy from Docker Compose'
                description='Paste a compose file and Quantum runs every service as its own container, on a network shared with the rest of your organization.'
                actions={(
                    <Button isPending={deploy.loading} isDisabled={!ready} onPress={() => { void handleDeploy(); }}>
                        Deploy
                        <ArrowRight aria-hidden='true' className='size-4' />
                    </Button>
                )}
            />

            <div className='mt-10'>
                <SettingsSection title='Stack' description='How the stack shows up in Applications.'>
                    <TextField value={name} onChange={setName} isDisabled={deploy.loading} validationBehavior='aria' fullWidth>
                        <Label>Name</Label>
                        <Input placeholder='my-stack' autoComplete='off' />
                    </TextField>

                    <div className='flex flex-col gap-1.5'>
                        <Label>Project</Label>
                        <EntitySelect
                            items={projects.data ?? []}
                            getKey={(project) => project.id}
                            getLabel={(project) => project.name}
                            value={projectId}
                            onChange={(key) => setProjectId(Number(key))}
                            placeholder='Select a project'
                            ariaLabel='Project'
                            isDisabled={deploy.loading || projects.loading}
                            emptyLabel='This organization has no projects yet'
                        />

                        {projects.data !== null && projects.data.length === 0 && (
                            <p className='text-[0.8125rem] text-muted'>
                                A stack deploys into a project, and this organization has none yet.{' '}
                                <RouterLink to='/projects' className='text-foreground underline underline-offset-4 hover:no-underline'>
                                    Create one in Projects
                                </RouterLink>
                                .
                            </p>
                        )}
                    </div>
                </SettingsSection>

                <SettingsSection
                    title='Compose file'
                    description='image, command, environment, ports, volumes and depends_on are honoured. Published ports are assigned by Quantum; build contexts and host bind mounts are not supported. Private images need registry credentials under Settings → Organization.'
                >
                    <MonacoEditor
                        value={compose}
                        language='yaml'
                        ariaLabel='Compose file'
                        isDisabled={deploy.loading}
                        onChange={setCompose}
                    />

                    {deploy.error !== undefined && <InlineError>{composeErrorMessage(deploy.error)}</InlineError>}
                </SettingsSection>
            </div>
        </PageBody>
    );
};

export default CreateCompose;
