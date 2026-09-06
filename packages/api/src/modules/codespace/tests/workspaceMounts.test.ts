import { describe, expect, it } from 'vitest';
import { installWorkspace, repositoryWorkspace, WORKSPACE_ROOT } from '../services/workspaceMounts';
import type DockerContainer from '@/modules/docker/models/DockerContainer';

const container = (dockerContainerName: string, paths: string[]) => ({
    dockerContainerName,
    volumes: paths.map((containerPath) => ({ containerPath, mode: 'rw' as const }))
}) as unknown as DockerContainer;

describe('workspace mounts', () => {
    it('binds the repository checkout at the workspace root', () => {
        expect(repositoryWorkspace('/var/lib/quantum/production/containers/1/github-repos/shop-3')).toEqual([
            { containerPath: WORKSPACE_ROOT, mode: 'rw', source: '/var/lib/quantum/production/containers/1/github-repos/shop-3' }
        ]);
    });

    it('mounts every named volume of a stack under its service name', () => {
        const volumes = installWorkspace([
            { name: 'api', container: container('quantum-container-production-8', ['/var/lib/api', '/etc/api']) },
            { name: 'db', container: container('quantum-container-production-9', ['/var/lib/postgresql/data']) },
            { name: 'web', container: container('quantum-container-production-10', []) }
        ]);

        expect(volumes).toEqual([
            { containerPath: `${WORKSPACE_ROOT}/api/var/lib/api`, mode: 'rw', source: 'quantum-container-production-8-varlibapi' },
            { containerPath: `${WORKSPACE_ROOT}/api/etc/api`, mode: 'rw', source: 'quantum-container-production-8-etcapi' },
            { containerPath: `${WORKSPACE_ROOT}/db/var/lib/postgresql/data`, mode: 'rw', source: 'quantum-container-production-9-varlibpostgresqldata' }
        ]);
    });
});
