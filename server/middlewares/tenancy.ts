import { Request, Response, NextFunction, RequestHandler } from 'express';
import mongoose from 'mongoose';
import Membership from '@models/membership';
import Project from '@models/project';
import Repository from '@models/repository';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { IRequest } from '@typings/controllers/common';
import { IUser } from '@typings/models/user';
import { IProject } from '@typings/models/project';
import { IRepository } from '@typings/models/repository';
import { Role, Action, PermissionMatrix } from '@typings/middlewares/tenancy';

export const PERMISSIONS: PermissionMatrix = {
    owner: new Set<Action>(['read', 'deploy', 'repo:write', 'project:write', 'project:delete', 'member:manage', 'token:manage', 'org:settings', 'org:delete']),
    admin: new Set<Action>(['read', 'deploy', 'repo:write', 'project:write', 'project:delete', 'member:manage', 'token:manage']),
    member: new Set<Action>(['read', 'deploy', 'repo:write']),
    viewer: new Set<Action>(['read'])
};

export const can = (role: Role | undefined, action: Action): boolean =>
    !!role && PERMISSIONS[role]?.has(action);

export const resolveScopeFilter = (req: IRequest, field: string): Record<string, any> => {
    if(!req.user) throw new RuntimeError('Tenancy::Context::Missing', 401);
    const tenant = req.tenant;
    if(tenant?.isPlatformAdmin) return {};
    if(!tenant) throw new RuntimeError('Tenancy::Context::Missing', 403);
    switch(field){
        case 'user':
            return { user: (req.user as IUser)._id };
        case '_id':
            return { _id: { $in: tenant.orgIds } };
        case 'organization':
            return tenant.org
                ? { organization: tenant.org._id }
                : { organization: { $in: tenant.orgIds } };
        case 'project':
            return tenant.project
                ? { project: tenant.project._id }
                : { project: { $in: tenant.projectIds } };
        default:
            throw new RuntimeError('Tenancy::Scope::UnknownField', 500);
    }
};

export const resolveCreateScope = (req: IRequest, field: string): Record<string, any> => {
    const tenant = req.tenant;
    switch(field){
        case 'user':
            return { user: (req.user as IUser)._id };
        case 'organization': {
            const orgId = tenant?.org?._id;
            return orgId ? { organization: orgId } : {};
        }
        case 'project':
            if(tenant?.project) return { project: tenant.project._id };
            return {};
        default:
            return {};
    }
};

const buildResolveTenant = ({ discovery = false }: { discovery?: boolean } = {}): RequestHandler =>
    catchAsync(async (req: IRequest, _res: Response, next: NextFunction) => {
        const user = req.user as IUser;
        if(!user) return next(new RuntimeError('Authentication::Required', 401));

        const isPlatformAdmin = user.role === 'admin';
        const memberships = await Membership.find({ user: user._id });
        const orgIds = memberships.map((m) => m.organization as mongoose.Types.ObjectId);

        const headerOrgId = (req.headers['x-organization-id'] as string | undefined) || undefined;
        const paramOrgId = (req.params.orgId || req.params.organizationId) as string | undefined;
        const projectId = req.params.projectId as string | undefined;

        let org: any;
        let project: any;
        let membership: any;
        let role: Role = 'viewer';

        const orgId = discovery ? paramOrgId : (paramOrgId || headerOrgId);

        const fromHeader = !discovery && !paramOrgId && !!headerOrgId;

        if(orgId){
            membership = memberships.find((m) => String(m.organization) === String(orgId) && !m.project);
            if(!membership && !isPlatformAdmin){

                return next(fromHeader
                    ? new RuntimeError('Tenancy::Organization::Reconfigure', 409)
                    : new RuntimeError('Tenancy::Organization::Forbidden', 403));
            }
            org = await mongoose.model('Organization').findById(orgId);
            if(!org){

                return next(fromHeader
                    ? new RuntimeError('Tenancy::Organization::Reconfigure', 409)
                    : new RuntimeError('Tenancy::Organization::NotFound', 404));
            }
            role = membership?.role || (isPlatformAdmin ? 'owner' : 'viewer');

            if(projectId){
                project = await Project.findById(projectId);
                if(!project || String(project.organization) !== String(orgId)){
                    return next(new RuntimeError('Tenancy::Project::NotFound', 404));
                }

                const projOverride = memberships.find(
                    (m) => String(m.project) === String(projectId)
                );
                if(projOverride) role = projOverride.role;
            }
        }else if(!discovery){

            const defaultOrgId = (user as any).defaultOrganization;
            if(defaultOrgId){
                membership = memberships.find((m) => String(m.organization) === String(defaultOrgId) && !m.project);
                org = await mongoose.model('Organization').findById(defaultOrgId);
            }

            if(!org && !isPlatformAdmin){
                return next(new RuntimeError('Tenancy::Organization::Reconfigure', 409));
            }
            role = membership?.role
                || memberships.find((m) => !m.project)?.role
                || (isPlatformAdmin ? 'owner' : 'member');
        }else{

            role = isPlatformAdmin ? 'owner' : (memberships.find((m) => !m.project)?.role || 'member');
        }

        const scopedOrgIds = org ? [org._id] : orgIds;
        const projectIds = await Project.find({ organization: { $in: scopedOrgIds } }).distinct('_id');

        req.tenant = {
            org,
            project,
            membership,
            role,
            orgIds,
            projectIds: projectIds as mongoose.Types.ObjectId[],
            isPlatformAdmin
        };
        next();
    });

export const resolveTenant: RequestHandler = buildResolveTenant({ discovery: false });

export const resolveTenantDiscovery: RequestHandler = buildResolveTenant({ discovery: true });

export const resolveProjectOr403 = async (req: IRequest, next: NextFunction, prefix: string): Promise<IProject | null> => {
    const project = await Project.findById(req.params.projectId);
    if(!project){ next(new RuntimeError(`${prefix}::Project::NotFound`, 404)); return null; }
    const orgIds = (req.tenant?.orgIds || []).map(String);
    if(!req.tenant?.isPlatformAdmin && !orgIds.includes(String(project.organization))){
        next(new RuntimeError(`${prefix}::Project::Forbidden`, 403)); return null;
    }
    return project;
};

export const resolveRepositoryOr403 = async (req: IRequest, repositoryId: string, prefix: string): Promise<IRepository> => {
    const repository = await Repository.findById(repositoryId).select('user project organization');
    if(!repository) throw new RuntimeError(`${prefix}::Repository::NotFound`, 404);
    if(req.tenant?.isPlatformAdmin) return repository;
    const isOwner = String(repository.user) === String((req.user as any)?._id);
    const projectIds = (req.tenant?.projectIds || []).map(String);
    const inProject = repository.project ? projectIds.includes(String(repository.project)) : false;
    if(!isOwner && !inProject){
        throw new RuntimeError(`${prefix}::Repository::Forbidden`, 403);
    }
    return repository;
};

export const requirePermission = (action: Action): RequestHandler =>
    (req: Request, _res: Response, next: NextFunction): void => {
        const { tenant } = req as IRequest;
        if(tenant?.isPlatformAdmin) return next();
        if(!tenant || !can(tenant.role, action)){
            return next(new RuntimeError('Authorization::Insufficient::Permissions', 403));
        }
        next();
    };
