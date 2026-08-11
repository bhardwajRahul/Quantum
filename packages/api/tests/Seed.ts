import User from '@/modules/user/models/User';
import PasswordService from '@/modules/auth/services/PasswordService';
import Organization from '@/modules/organization/models/Organization';
import OrganizationMembership from '@/modules/organization/models/OrganizationMembership';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import { UserRole } from '@quantum/contracts/modules/user/domain';

export interface OrgContext{
    user: User;
    org: Organization;
}

export const TEST_PASSWORD = 'password123';

export default class Seed{
    static #sequence = 0;

    protected sequence(): number{
        return ++Seed.#sequence;
    }

    async user(role: UserRole = UserRole.User): Promise<User>{
        const n = this.sequence();
        return User.create({
            username: `user${n}quantum`,
            fullname: `User Number ${n}`,
            email: `user${n}@quantum.test`,
            role,
            passwordHash: await new PasswordService().hash(TEST_PASSWORD)
        }).save();
    }

    async org(creator: User): Promise<Organization>{
        const n = this.sequence();
        const organization = await Organization.create({
            name: `Org ${n}`,
            slug: `org-${n}-${creator.id}`,
            ownerId: creator.id
        }).save();

        await OrganizationMembership.create({
            userId: creator.id,
            organizationId: organization.id,
            projectId: null,
            role: OrganizationRole.Owner
        }).save();

        if(creator.defaultOrganizationId === null){
            creator.defaultOrganizationId = organization.id;
            await creator.save();
        }

        return organization;
    }

    async member(org: Organization, role: OrganizationRole = OrganizationRole.Member): Promise<User>{
        const user = await this.user();
        await OrganizationMembership.create({
            userId: user.id,
            organizationId: org.id,
            projectId: null,
            role
        }).save();
        return user;
    }

    async orgContext(role: OrganizationRole = OrganizationRole.Owner): Promise<OrgContext>{
        const user = await this.user();
        const org = await this.org(user);
        if(role !== OrganizationRole.Owner){
            await OrganizationMembership.update({ userId: user.id, organizationId: org.id }, { role });
        }
        return { user, org };
    }
}

export const seed = new Seed();
