import type { TemplateDeletedPayload, TemplateInstalledPayload } from '../domain/events';

declare global{
    interface EventMap{
        'template.installed': TemplateInstalledPayload;
        'template.deleted': TemplateDeletedPayload;
    }
}
