import { TemplateErrors, TemplateInstallErrors } from '@quantum/contracts/modules/template/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const TemplateError = defineErrors(TemplateErrors);
export const TemplateInstallError = defineErrors(TemplateInstallErrors);
