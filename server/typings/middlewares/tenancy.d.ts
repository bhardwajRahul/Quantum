import mongoose from 'mongoose';
import { IOrganization } from '@typings/models/organization';
import { IProject } from '@typings/models/project';
import { IMembership } from '@typings/models/membership';

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export type Action =
    | 'read'
    | 'deploy'
    | 'repo:write'
    | 'project:write'
    | 'project:delete'
    | 'member:manage'
    | 'token:manage'
    | 'org:settings'
    | 'org:delete';

export interface ITenantContext{
    org?: IOrganization;
    project?: IProject;
    membership?: IMembership;
    role: Role;
    orgIds: mongoose.Types.ObjectId[];
    projectIds: mongoose.Types.ObjectId[];
    isPlatformAdmin: boolean;
}

export type PermissionMatrix = Record<Role, Set<Action>>;
