import type { ErrorCode, ErrorTable } from '../../shared/errors';

export const TemplateErrors = {
    domain: 'Template',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        SlugAlreadyTaken: 409
    }
} as const satisfies ErrorTable;

export type TemplateErrorCode = ErrorCode<typeof TemplateErrors>;

export const TemplateInstallErrors = {
    domain: 'TemplateInstall',
    causes: {
        NotFound: 404,
        Forbidden: 403,
        MissingInput: 400,
        InvalidCompose: 400,
        UnsupportedCompose: 400,
        NotCompose: 400,
        UnknownService: 400
    }
} as const satisfies ErrorTable;

export type TemplateInstallErrorCode = ErrorCode<typeof TemplateInstallErrors>;
