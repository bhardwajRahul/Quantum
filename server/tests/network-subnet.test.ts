import { describe, it, expect } from 'vitest';
import { pickFreeSubnet, randomIPv4Subnet } from '@services/docker/network';

// Regression net for the "Pool overlaps with other one on this address space"
// 403: createNetwork used to get a blindly-chosen /24 that collided with an
// existing Docker network (including a /24 inside 172.16/12 overlapping Docker's
// own /16 bridges). pickFreeSubnet must never return an overlapping range.

const cidr = /^10\.\d{1,3}\.\d{1,3}\.0\/24$/;

describe('pickFreeSubnet (collision-free subnet allocation)', () => {
    it('always stays inside 10.0.0.0/8 as a /24', () => {
        for(let i = 0; i < 50; i++){
            expect(randomIPv4Subnet()).toMatch(cidr);
        }
    });

    it('returns a /24 that overlaps none of the existing subnets', () => {
        // Mirrors the live daemon: Docker /16 bridges + prior quantum /24s.
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
        // 10.5.0.0/16 covers 10.5.0.0–10.5.255.255. A naive first-three-octet
        // check would wrongly free 10.5.7.0/24; real overlap math must reject it.
        const existing = ['10.5.0.0/16'];
        // rng keeps proposing a /24 INSIDE the taken /16; picker must skip it and
        // fall through to a non-overlapping range.
        const got = pickFreeSubnet(existing, () => '10.5.7.0/24');
        expect(got).toMatch(cidr);
        expect(got).not.toBe('10.5.7.0/24');
        // Sanity: the chosen one really is outside 10.5/16.
        expect(got.startsWith('10.5.')).toBe(false);
    });

    it('falls back to a deterministic scan when random keeps colliding', () => {
        // rng always returns an occupied /24 → exercise the linear-scan fallback.
        const existing = ['10.0.0.0/24'];
        const got = pickFreeSubnet(existing, () => '10.0.0.0/24');
        expect(got).toMatch(cidr);
        expect(got).toBe('10.0.1.0/24'); // first free /24 after 10.0.0.0
    });

    it('throws when 10.0.0.0/8 is fully exhausted', () => {
        // Block the entire /8 with one broad entry so nothing is free.
        expect(() => pickFreeSubnet(['10.0.0.0/8'], () => '10.1.2.0/24'))
            .toThrow(/SubnetExhausted/);
    });
});
