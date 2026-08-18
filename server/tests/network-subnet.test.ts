import { describe, it, expect } from 'vitest';
import { pickFreeSubnet, randomIPv4Subnet } from '@services/docker/network';

const cidr = /^10\.\d{1,3}\.\d{1,3}\.0\/24$/;

describe('pickFreeSubnet (collision-free subnet allocation)', () => {
    it('always stays inside 10.0.0.0/8 as a /24', () => {
        for(let i = 0; i < 50; i++){
            expect(randomIPv4Subnet()).toMatch(cidr);
        }
    });

    it('returns a /24 that overlaps none of the existing subnets', () => {

        const existing = [
            '172.17.0.0/16', '172.18.0.0/16', '172.23.0.0/16',
            '10.0.0.0/24', '10.5.7.0/24', '192.168.87.0/24'
        ];
        for(let i = 0; i < 100; i++){
            const got = pickFreeSubnet(existing);
            expect(got).toMatch(cidr);
            expect(existing).not.toContain(got);
        }
    });

    it('does not hand back a /24 that sits inside an existing wider prefix', () => {

        const existing = ['10.5.0.0/16'];

        const got = pickFreeSubnet(existing, () => '10.5.7.0/24');
        expect(got).toMatch(cidr);
        expect(got).not.toBe('10.5.7.0/24');

        expect(got.startsWith('10.5.')).toBe(false);
    });

    it('falls back to a deterministic scan when random keeps colliding', () => {

        const existing = ['10.0.0.0/24'];
        const got = pickFreeSubnet(existing, () => '10.0.0.0/24');
        expect(got).toMatch(cidr);
        expect(got).toBe('10.0.1.0/24');
    });

    it('throws when 10.0.0.0/8 is fully exhausted', () => {

        expect(() => pickFreeSubnet(['10.0.0.0/8'], () => '10.1.2.0/24'))
            .toThrow(/SubnetExhausted/);
    });
});
