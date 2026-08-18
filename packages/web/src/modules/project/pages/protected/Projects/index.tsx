import { useState } from 'react';
import { Button } from '@heroui/react';
import { FolderKanban, Plus } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import ProjectCard from '@/modules/project/components/ProjectCard';
import CreateProjectDialog from '@/modules/project/components/CreateProjectDialog';
import RenameProjectDialog from '@/modules/project/components/RenameProjectDialog';
import ManageEnvironmentsDialog from '@/modules/project/components/ManageEnvironmentsDialog';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { projectApi } from '@/modules/project/api/api';
import { useCurrentOrganizationId } from '@/modules/organization/hooks/use-current-organization-id';
import { projectErrorMessages } from '@/modules/project/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Project } from '@quantum/contracts/modules/project/domain';

const copy = errorCopy(projectErrorMessages);

interface ProjectsHeaderProps{
    onCreate: () => void;
}

const ProjectsHeader = ({ onCreate }: ProjectsHeaderProps) => (
    <div className='flex items-center justify-between gap-4'>
        <div>
            <h1 className='text-lg font-medium text-foreground'>Projects</h1>
            <p className='mt-1.5 text-sm text-muted'>Group related deployments by organization.</p>
        </div>

        <Button onPress={onCreate}>
            <Plus aria-hidden='true' className='size-4' />
            New project
        </Button>
    </div>
);

interface DeleteProjectDialogProps{
    project: Project | null;
    onClose: () => void;
    onDeleted: () => void;
}

const DeleteProjectDialog = ({ project, onClose, onDeleted }: DeleteProjectDialogProps) => {
    const remove = useMutation((projectId: number) => projectApi.remove(projectId));

    const handleDelete = async () => {
        if(project === null) return;

        const deleted = await remove.run(project.id).then(() => true, () => false);
        if(!deleted) return;

        onClose();
        onDeleted();
    };

    return (
        <ConfirmDialog
            isOpen={project !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title='Delete project'
            description={project === null
                ? ''
                : `This permanently removes "${project.name}" and its environments. This action cannot be undone.`}
            confirmLabel='Delete'
            isPending={remove.loading}
            error={copy(remove.error)}
            onConfirm={() => { void handleDelete(); }}
        />
    );
};

const Projects = () => {
    const organizationId = useCurrentOrganizationId();
    const projects = useQuery(projectApi.listByOrganization, [organizationId ?? undefined]);
    const [createOpen, setCreateOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<Project | null>(null);
    const [environmentsTarget, setEnvironmentsTarget] = useState<Project | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

    if(organizationId === null) return <CenterState className='h-full'><LoadingState title='Loading projects' compact /></CenterState>;
    if(projects.loading) return <CenterState className='h-full'><LoadingState title='Loading projects' compact /></CenterState>;
    if(projects.error !== undefined){
        return (
            <CenterState className='h-full'>
                <ErrorState title='Could not load projects' description={copy(projects.error)} onRetry={projects.reload} />
            </CenterState>
        );
    }

    const items = projects.data ?? [];

    return (
        <PageBody width='wide' height='full'>
            <ProjectsHeader onCreate={() => setCreateOpen(true)} />

            <div className='mt-6 flex flex-1 flex-col'>
                {items.length === 0 ? (
                    <CenterState>
                        <EmptyState
                            icon={FolderKanban}
                            title='No projects yet'
                            description='Projects group related deployments. Create your first one to get started.'
                        >
                            <Button onPress={() => setCreateOpen(true)}>
                                <Plus aria-hidden='true' className='size-4' />
                                New project
                            </Button>
                        </EmptyState>
                    </CenterState>
                ) : (
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
                )}
            </div>

            <CreateProjectDialog
                organizationId={organizationId}
                isOpen={createOpen}
                onClose={setCreateOpen}
                onCreated={projects.reload}
            />

            <RenameProjectDialog
                key={renameTarget?.id ?? 'rename'}
                project={renameTarget}
                onClose={() => setRenameTarget(null)}
                onRenamed={projects.reload}
            />

            <ManageEnvironmentsDialog
                key={environmentsTarget?.id ?? 'environments'}
                project={environmentsTarget}
                onClose={() => setEnvironmentsTarget(null)}
            />

            <DeleteProjectDialog
                project={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onDeleted={projects.reload}
            />
        </PageBody>
    );
};

export default Projects;
