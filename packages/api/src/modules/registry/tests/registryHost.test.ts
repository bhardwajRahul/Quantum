import { describe, expect, it } from 'vitest';
import { normalizeRegistry, registryOf, serverAddressOf } from '../services/registryHost';

describe('registry host', () => {
    it('reads the registry out of an image reference, defaulting to Docker Hub', () => {
        expect(registryOf('nginx')).toBe('docker.io');
        expect(registryOf('library/nginx:1.27')).toBe('docker.io');
        expect(registryOf('index.docker.io/library/nginx')).toBe('docker.io');
        expect(registryOf('ghcr.io/acme/api:latest')).toBe('ghcr.io');
        expect(registryOf('GHCR.io/acme/api')).toBe('ghcr.io');
        expect(registryOf('localhost:5000/team/app')).toBe('localhost:5000');
        expect(registryOf('registry.example.com:8443/ns/app@sha256:abc')).toBe('registry.example.com:8443');
    });

    it('normalizes what a person types as a registry', () => {
        expect(normalizeRegistry(' https://ghcr.io/ ')).toBe('ghcr.io');
        expect(normalizeRegistry('Docker.io')).toBe('docker.io');
        expect(normalizeRegistry('hub.docker.com/acme')).toBe('docker.io');
        expect(normalizeRegistry('registry.example.com:5000')).toBe('registry.example.com:5000');
        expect(normalizeRegistry('')).toBeNull();
        expect(normalizeRegistry('not a host')).toBeNull();
    });

    it('uses the legacy Hub endpoint as the Docker Hub server address', () => {
        expect(serverAddressOf('docker.io')).toBe('https://index.docker.io/v1/');
        expect(serverAddressOf('ghcr.io')).toBe('ghcr.io');
    });
});
