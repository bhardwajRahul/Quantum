import { ListBox, ListBoxItem, Select } from '@heroui/react';
import type { Project } from '@quantum/contracts/modules/project/domain';

interface ProjectSelectProps{
    projects: Project[];
    value: number | null;
    onChange: (projectId: number) => void;
    isDisabled?: boolean;
    ariaLabel?: string;
}

const ProjectSelect = ({
    projects,
    value,
    onChange,
    isDisabled = false,
    ariaLabel = 'Project'
}: ProjectSelectProps) => (
    <Select
        aria-label={ariaLabel}
        selectedKey={value ?? null}
        isDisabled={isDisabled}
        onSelectionChange={(key) => onChange(Number(key))}
    >
        <Select.Trigger>
            <Select.Value>Select a project</Select.Value>
            <Select.Indicator />
        </Select.Trigger>

        <Select.Popover>
            <ListBox>
                {projects.map((project) => (
                    <ListBoxItem key={project.id} id={project.id} textValue={project.name}>
                        {project.name}
                    </ListBoxItem>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

export default ProjectSelect;
