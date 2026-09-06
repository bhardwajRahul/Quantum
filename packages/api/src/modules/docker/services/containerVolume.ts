import slugify from 'slugify';

export const namedVolume = (dockerContainerName: string, containerPath: string): string =>
    `${dockerContainerName}-${slugify(containerPath)}`;
