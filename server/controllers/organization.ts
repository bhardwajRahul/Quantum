import slugify from 'slugify';
import { v4 } from 'uuid';
import Organization from '@models/organization';
import Membership from '@models/membership';
import User from '@models/user';
import HandlerFactory from '@controllers/common/handlerFactory';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { enqueueOrgCascadeDelete, enqueueReconcile } from '@services/orchestrator';
import { ensureOrgDefaults, createUserContainer } from '@services/tenancy/provisioning';
import { IUser } from '@typings/models/user';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const OrganizationFactory = new HandlerFactory({
    model: Organization,
    scope: { field: '_id' },
    fields: ['name']
});

export const getOrganizations = OrganizationFactory.getAll();
export const getOrganization = OrganizationFactory.getOne();
export const updateOrganization = OrganizationFactory.updateOne();

export const createOrganization = catchAsync(async (req: IRequest, res: Response): Promise<void> => {
    const user: any = req.user;
    const { name } = req.body;
    const slug = `${slugify(name, { lower: true, strict: true })}-${v4().slice(0, 4)}`;
    const organization = await Organization.create({ name, slug, owner: user._id });
    await Membership.create({ user: user._id, organization: organization._id, role: 'owner' });

    await ensureOrgDefaults(organization._id);

    if(!user.defaultOrganization){
        await User.updateOne({ _id: user._id }, { defaultOrganization: organization._id });
        user.defaultOrganization = organization._id;

        await createUserContainer(user as IUser, organization._id);
        enqueueReconcile().catch(() => {   });
    }

    res.status(201).json({ status: 'success', data: organization });
});

export const deleteOrganization = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const user: any = req.user;

    const organization = await Organization.findById(req.params.id);
    const isOwnTenant = String(organization?._id) === String(req.tenant?.org?._id);
    if(!organization || !(req.tenant?.isPlatformAdmin || isOwnTenant)){
        return next(new RuntimeError('Organization::NotFound', 404));
    }

    const organizationId = String(organization._id);
    await enqueueOrgCascadeDelete(organizationId, { userId: String(user._id) });

    res.status(202).json({
        status: 'success',
        data: { id: organizationId, message: 'Organization deletion enqueued.' }
    });
});

export default {
    getOrganizations,
    getOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization
};
