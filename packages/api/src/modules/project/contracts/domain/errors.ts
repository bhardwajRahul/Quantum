import { EnvironmentErrors, ProjectErrors } from '@quantum/contracts/modules/project/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const ProjectError = defineErrors(ProjectErrors);
export const EnvironmentError = defineErrors(EnvironmentErrors);
