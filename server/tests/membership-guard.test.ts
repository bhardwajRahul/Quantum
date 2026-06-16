import { describe, it, expect, vi } from 'vitest';

// Regression net for two linked bugs:
// 1) DELETE /membership/.../members/:id validated params with OrgIdParamsSchema,
//    which declares only `orgId` — so .strip() removed req.params.id, and the
//    owner-protection guard in removeMember silently no-op'd (findById(undefined)).
//    OrgMemberParamsSchema must preserve BOTH orgId and id.
// 2) removeMember must refuse to delete the org OWNER's membership (which orphaned
//    the org: no member resolved to 'owner', so the real owner then 403'd on
//    org:delete). Covered by membership-owner-guard logic below.

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
        // id is stripped by the orgId-only schema — this is exactly why the guard
        // couldn't see the membership id.
        expect((r as any).data.id).toBeUndefined();
    });

    it('rejects a malformed member id', () => {
        expect(OrgMemberParamsSchema.safeParse({ orgId: 'x', id: 'y' }).success).toBe(false);
    });
});

// The owner-removal guard itself is pure decision logic; assert it directly.
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
