import type { TemplateDeletedPayload, TemplateInstalledPayload, TemplateUninstalledPayload } from '../domain/events';

declare global{
    interface EventMap{
        'template.installed': TemplateInstalledPayload;
        'template.deleted': TemplateDeletedPayload;
        'template.uninstalled': TemplateUninstalledPayload;
    }
}
