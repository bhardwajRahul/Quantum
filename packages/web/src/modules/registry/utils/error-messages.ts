import type { RegistryCredentialErrorCode } from '@quantum/contracts/modules/registry/errors';
import { forbidden, notFound } from '@/shared/utils/error-messages';

export const registryErrorMessages: Partial<Record<RegistryCredentialErrorCode, string>> = {
    'RegistryCredential::NotFound': notFound('registry credential'),
    'RegistryCredential::Forbidden': forbidden('registry credential'),
    'RegistryCredential::AlreadyExists': 'This organization already has credentials for that registry. Remove them first to replace them.',
    'RegistryCredential::InvalidRegistry': 'Enter the registry host (for example ghcr.io), a username and a token.'
};
