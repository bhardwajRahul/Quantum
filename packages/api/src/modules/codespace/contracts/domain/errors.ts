import { CodespaceErrors, PortBindingErrors } from '@quantum/contracts/modules/codespace/errors';
import { defineErrors } from '@/shared/errors/defineErrors';

export const CodespaceError = defineErrors(CodespaceErrors);
export const PortBindingError = defineErrors(PortBindingErrors);
