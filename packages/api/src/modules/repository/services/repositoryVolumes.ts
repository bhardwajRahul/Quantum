import { RepositoryError } from '../contracts/domain/errors';

const RESERVED = new Set(['/', '/app']);

const normalizePath = (raw: string): string => {
    const trimmed = raw.trim().replace(/\/+$/, '');
    const path = trimmed === '' ? '/' : trimmed;
    if(!path.startsWith('/') || path.split('/').some((segment) => segment === '..') || RESERVED.has(path)){
        throw RepositoryError.InvalidVolume(raw.trim());
    }
    return path;
};

export const normalizeVolumes = (paths: string[]): string[] => [...new Set(paths.map(normalizePath))];
