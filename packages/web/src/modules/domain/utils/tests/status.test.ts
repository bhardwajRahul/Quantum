import { describe, expect, it } from 'vitest';
import { domainStatusColor, domainStatusLabel } from '@/modules/domain/utils/status';
import { DomainStatus } from '@quantum/contracts/modules/domain/domain';

describe('domainStatus', () => {
    it('marks active domains as success', () => {
        expect(domainStatusLabel(DomainStatus.Active)).toBe('Active');
        expect(domainStatusColor(DomainStatus.Active)).toBe('success');
    });

    it('marks pending verification as warning', () => {
        expect(domainStatusLabel(DomainStatus.Pending)).toBe('Pending');
        expect(domainStatusColor(DomainStatus.Pending)).toBe('warning');
    });

    it('marks failed domains as danger', () => {
        expect(domainStatusLabel(DomainStatus.Error)).toBe('Error');
        expect(domainStatusColor(DomainStatus.Error)).toBe('danger');
    });
});
