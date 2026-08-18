import Membership from '@models/membership';
import Organization from '@models/organization';
import HandlerFactory from '@controllers/common/handlerFactory';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const MembershipFactory = new HandlerFactory({
    model: Membership,
    scope: { field: 'organization' },
    fields: ['user', 'role']
});

export const getMembers = catchAsync(async (req: IRequest, res: Response, _next: NextFunction): Promise<void> => {
    const organization = req.tenant?.org?._id;
    const records = await Membership
        .find({ organization })
        .populate({ path: 'user', select: 'fullname username email' })
        .lean();
    res.status(200).json({ status: 'success', data: records });
});

export const updateMember = MembershipFactory.updateOne();

const factoryRemove = MembershipFactory.deleteOne();

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
