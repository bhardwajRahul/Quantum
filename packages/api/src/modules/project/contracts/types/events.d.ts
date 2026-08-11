import type { ProjectCreatedPayload, ProjectDeletedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'project.created': ProjectCreatedPayload;
        'project.deleted': ProjectDeletedPayload;
    }
}
