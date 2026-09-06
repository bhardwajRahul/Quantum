import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';

const copy = errorCopy(templateErrorMessages);

const COMPOSE_ERROR = /^TemplateInstall::(InvalidCompose|UnsupportedCompose|UnsetVariable|ComposeFileNotFound)(?::(.*))?$/s;

const invalid = (detail: string): string => {
    const [kind, service, rest] = detail.split(':');
    if(kind === 'yaml') return `The compose file is not valid YAML: ${detail.slice('yaml:'.length)}`;
    if(kind === 'document' || kind === 'services') return 'The compose file needs a services section with at least one service.';
    if(kind === 'image') return `Service ${service} needs an image.`;
    if(kind === 'depends_on' && rest !== undefined) return `Service ${service} depends on ${rest}, which is not defined.`;
    if(kind === 'ports' && rest !== undefined) return `Service ${service} has an invalid port: ${rest}.`;
    if(kind === 'service') return `Service ${service} must be a mapping.`;
    return `Service ${service} has an invalid ${kind}.`;
};

const unsupported = (detail: string): string => {
    const [kind, service, ...rest] = detail.split(':');
    if(kind === 'build') return `Service ${service} uses build, which only a stack deployed from a repository can do.`;
    if(kind === 'bind-mount') return `Service ${service} mounts the host path ${rest.join(':')}; only named volumes are supported.`;
    return `Service ${service} uses ${kind}, which Quantum cannot deploy.`;
};

export const composeErrorMessage = (error: Error): string => {
    const match = COMPOSE_ERROR.exec(error.message);
    if(match === null || match[2] === undefined) return copy(error);
    if(match[1] === 'UnsetVariable') return `The compose file uses ${match[2]} and it has no value. Set it under Variables.`;
    if(match[1] === 'ComposeFileNotFound') return `The repository has no ${match[2]} on that branch.`;
    return match[1] === 'InvalidCompose' ? invalid(match[2]) : unsupported(match[2]);
};
