import { DockerErrors } from '@quantum/contracts/modules/docker/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const DockerError = defineErrors(DockerErrors);
