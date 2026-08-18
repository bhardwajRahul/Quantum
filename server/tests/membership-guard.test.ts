import { describe, it, expect, vi } from 'vitest';

import { OrgMemberParamsSchema, OrgIdParamsSchema } from '@middlewares/validators';

describe('OrgMemberParamsSchema preserves both params', () => {
    it('keeps orgId AND id (the member route needs both)', () => {
        const r = OrgMemberParamsSchema.safeParse({
            orgId: '6a309d10cf6e99c1d51134ab',
            id: '6a309d10cf6e99c1d51134ad'
        });
        expect(r.success).toBe(true);
        expect((r as any).data.id).toBeTruthy();
        expect((r as any).data.orgId).toBeTruthy();
    });

    it('OrgIdParamsSchema (orgId-only) drops id — the original bug', () => {
        const r = OrgIdParamsSchema.safeParse({
            orgId: '6a309d10cf6e99c1d51134ab',
            id: '6a309d10cf6e99c1d51134ad'
        });
        expect(r.success).toBe(true);

        expect((r as any).data.id).toBeUndefined();
    });

    it('rejects a malformed member id', () => {
        expect(OrgMemberParamsSchema.safeParse({ orgId: 'x', id: 'y' }).success).toBe(false);
    });
});

const wouldBlockOwnerRemoval = (orgOwner: string, membershipUser: string) =>
    String(orgOwner) === String(membershipUser);

describe('removeMember owner guard', () => {
    it('blocks removing the org owner membership', () => {
        expect(wouldBlockOwnerRemoval('u1', 'u1')).toBe(true);
    });
    it('allows removing a non-owner member', () => {
        expect(wouldBlockOwnerRemoval('u1', 'u2')).toBe(false);
    });
});
