import { Card, Dropdown } from '@heroui/react';
import { MoreVertical } from 'lucide-react';
import type { Project } from '@quantum/contracts/modules/project/domain';

interface ProjectCardProps{
    project: Project;
    onRename: () => void;
    onManageEnvironments: () => void;
    onDelete: () => void;
}

const ProjectCard = ({ project, onRename, onManageEnvironments, onDelete }: ProjectCardProps) => (
    <Card>
        <Card.Header>
            <Card.Title className='truncate'>{project.name}</Card.Title>
            <Card.Description className='truncate'>{project.slug}</Card.Description>
        </Card.Header>

        <Card.Content className='flex items-center justify-between gap-2'>
            <span className='text-[0.8125rem] text-muted'>
                {project.isDefault ? 'Default project' : 'Project'}
            </span>

            <Dropdown>
                <Dropdown.Trigger
                    aria-label={`Actions for ${project.name}`}
                    className='rounded-md p-1.5 text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
                >
                    <MoreVertical aria-hidden='true' className='size-4' />
                </Dropdown.Trigger>

                <Dropdown.Popover placement='bottom end'>
                    <Dropdown.Menu aria-label={`Actions for ${project.name}`}>
                        <Dropdown.Item onAction={onRename}>Rename</Dropdown.Item>
                        <Dropdown.Item onAction={onManageEnvironments}>Manage environments</Dropdown.Item>
                        <Dropdown.Item variant='danger' onAction={onDelete}>Delete</Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>
        </Card.Content>
    </Card>
);

export default ProjectCard;
