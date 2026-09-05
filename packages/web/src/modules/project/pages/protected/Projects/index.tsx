import { useState } from 'react';
import { Button } from '@heroui/react';
import { FolderKanban, Plus } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import PageHeader from '@/shared/components/layout/PageHeader';
import ListPageShell from '@/shared/components/ListPageShell';
import DeleteConfirmDialog from '@/shared/components/DeleteConfirmDialog';
import ProjectCard from '@/modules/project/components/ProjectCard';
import CreateProjectDialog from '@/modules/project/components/CreateProjectDialog';
import RenameProjectDialog from '@/modules/project/components/RenameProjectDialog';
import ManageEnvironmentsDialog from '@/modules/project/components/ManageEnvironmentsDialog';
import { useResource } from '@/shared/hooks/api/use-resource';
import { projectApi } from '@/modules/project/api/api';
import { projectRoutes } from '@quantum/contracts/modules/project/routes';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { projectErrorMessages } from '@/modules/project/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Project } from '@quantum/contracts/modules/project/domain';

const copy = errorCopy(projectErrorMessages);

interface ProjectsHeaderProps{
    onCreate: () => void;
}

const ProjectsHeader = ({ onCreate }: ProjectsHeaderProps) => (
    <PageHeader
        title='Projects'
        description='Group related deployments by organization.'
        actions={(
            <Button onPress={onCreate}>
                <Plus aria-hidden='true' className='size-4' />
                New project
            </Button>
        )}
    />
);

interface DeleteProjectDialogProps{
    project: Project | null;
    onClose: () => void;
    onDeleted: () => void;
}

const DeleteProjectDialog = ({ project, onClose, onDeleted }: DeleteProjectDialogProps) => (
    <DeleteConfirmDialog
        isOpen={project !== null}
        title='Delete project'
        description={project === null
            ? ''
            : `This permanently removes "${project.name}" and its environments. This action cannot be undone.`}
        entityId={project?.id ?? null}
        remove={(projectId) => projectApi.remove({ path: { id: projectId } })}
        getErrorMessage={copy}
        onClose={onClose}
        onRemoved={onDeleted}
    />
);

const Projects = () => {
    const organizationId = useCurrentOrganizationId();
    const projects = useResource(projectRoutes, {
        list: 'listByOrganization',
        request: organizationId === null ? null : { path: { orgId: organizationId } }
    });
    const [createOpen, setCreateOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<Project | null>(null);
    const [environmentsTarget, setEnvironmentsTarget] = useState<Project | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

    if(organizationId === null || projects.loading || projects.error !== undefined){
        return (
            <ListPageShell
                fill
                loading={organizationId === null || projects.loading}
                loadingTitle='Loading projects'
                error={organizationId === null ? undefined : projects.error}
                errorTitle='Could not load projects'
                getErrorDescription={copy}
                onRetry={projects.refresh}
            />
        );
    }

    const items = projects.data ?? [];

    return (
        <PageBody width='wide' height='full'>
            <ProjectsHeader onCreate={() => setCreateOpen(true)} />

            <div className='mt-6 flex flex-1 flex-col'>
                <ListPageShell
                    loadingTitle='Loading projects'
                    errorTitle='Could not load projects'
                    getErrorDescription={copy}
                    onRetry={projects.refresh}
                    isEmpty={items.length === 0}
                    empty={{
                        icon: FolderKanban,
                        title: 'No projects yet',
                        description: 'Projects group related deployments. Create your first one to get started.',
                        action: (
                            <Button onPress={() => setCreateOpen(true)}>
                                <Plus aria-hidden='true' className='size-4' />
                                New project
                            </Button>
                        )
                    }}
                >
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                        {items.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onRename={() => setRenameTarget(project)}
                                onManageEnvironments={() => setEnvironmentsTarget(project)}
                                onDelete={() => setDeleteTarget(project)}
                            />
                        ))}
                    </div>
                </ListPageShell>
            </div>

            <CreateProjectDialog
                organizationId={organizationId}
                isOpen={createOpen}
                onClose={setCreateOpen}
                onCreated={projects.refresh}
            />

            <RenameProjectDialog
                key={renameTarget?.id ?? 'rename'}
                project={renameTarget}
                onClose={() => setRenameTarget(null)}
                onRenamed={projects.refresh}
            />

            <ManageEnvironmentsDialog
                key={environmentsTarget?.id ?? 'environments'}
                project={environmentsTarget}
                onClose={() => setEnvironmentsTarget(null)}
            />

            <DeleteProjectDialog
                project={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onDeleted={projects.refresh}
            />
        </PageBody>
    );
};

export default Projects;
