/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place.
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

import Membership from '@models/membership';
import Organization from '@models/organization';
import HandlerFactory from '@controllers/common/handlerFactory';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

/**
 * Memberships are scoped by organization, so members of an org can list/manage
 * its memberships (gated further by requirePermission('member:manage') on the
 * mutating routes), but never see another org's roster.
 */
const MembershipFactory = new HandlerFactory({
    model: Membership,
    scope: { field: 'organization' },
    fields: ['user', 'role']
});

export const getMembers = MembershipFactory.getAll();
export const updateMember = MembershipFactory.updateOne();

const factoryRemove = MembershipFactory.deleteOne();

/**
 * Remove a member from the org. Refuses to remove the organization OWNER's
 * membership — doing so orphaned the org (no member resolves to the 'owner' role,
 * so even the real owner then 403s on org:delete/settings). The owner leaves only
 * by deleting the org (cascade) or transferring ownership.
 */
export const removeMember = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const membership = await Membership.findById(req.params.id);
    if(membership){
        const organization = await Organization.findById(membership.organization);
        if(organization && String(organization.owner) === String(membership.user)){
            return next(new RuntimeError('Membership::CannotRemoveOwner', 403));
        }
    }
    return factoryRemove(req, res, next);
});

/**
 * Invites (grants a role to) an existing user in the org resolved from :orgId.
 * The organization is taken from the verified tenant context, never the body.
 * Idempotent-ish: a duplicate (user, org) grant is rejected by the unique index.
 */
export const inviteMember = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const organization = req.tenant?.org?._id;
    if(!organization){
        return next(new RuntimeError('Membership::Organization::Required', 400));
    }
    const { user, role } = req.body;
    const existing = await Membership.findOne({ user, organization, project: null });
    if(existing){
        existing.role = role;
        await existing.save();
        res.status(200).json({ status: 'success', data: existing });
        return;
    }
    const membership = await Membership.create({ user, organization, role });
    res.status(201).json({ status: 'success', data: membership });
});

export default {
    getMembers,
    inviteMember,
    updateMember,
    removeMember
};
