import { In, IsNull } from 'typeorm';
import User from '@/modules/user/models/User';
import { OrganizationRole } from '@quantum/contracts/modules/organization/domain';
import Organization from '../models/Organization';
import OrganizationMembership from '../models/OrganizationMembership';
import { TenancyError } from '../contracts/domain/errors';
import type { Member } from '@quantum/contracts/modules/organization/domain';
import type { InviteMemberInput, UpdateMemberInput } from '@quantum/contracts/modules/organization/http';

export default class MembershipService{
    async listMembers(orgId: number): Promise<Member[]>{
        const memberships = await OrganizationMembership.find({
            where: { organizationId: orgId, projectId: IsNull() },
            order: { id: 'ASC' }
        });
        if(memberships.length === 0) return [];

        const users = await User.find({ where: { id: In(memberships.map((membership) => membership.userId)) } });
        const usersById = new Map(users.map((user) => [user.id, user] as const));

        return memberships.flatMap((membership) => {
            const user = usersById.get(membership.userId);
            return user === undefined ? [] : [this.#toMember(membership, user)];
        });
    }

    async invite(orgId: number, input: InviteMemberInput): Promise<Member>{
        const user = await User.findOneBy({ email: input.email.toLowerCase() });
        if(!user) throw TenancyError.UserNotFound();

        const existing = await OrganizationMembership.findOneBy({
            userId: user.id,
            organizationId: orgId,
            projectId: IsNull()
        });
        if(existing) throw TenancyError.MembershipAlreadyExists();

        const membership = await OrganizationMembership.create({
            userId: user.id,
            organizationId: orgId,
            projectId: null,
            role: input.role
        }).save();

        return this.#toMember(membership, user);
    }

    async updateRole(orgId: number, membershipId: number, input: UpdateMemberInput): Promise<Member>{
        const membership = await this.#get(orgId, membershipId);
        if(membership.role === OrganizationRole.Owner && input.role !== OrganizationRole.Owner){
            throw TenancyError.CannotDemoteOwner();
        }

        membership.role = input.role;
        await membership.save();

        const user = await User.findOneBy({ id: membership.userId });
        if(!user) throw TenancyError.MemberNotFound();
        return this.#toMember(membership, user);
    }

    async remove(orgId: number, membershipId: number): Promise<void>{
        const membership = await this.#get(orgId, membershipId);
        const organization = await Organization.findOneBy({ id: orgId });
        if(organization && organization.ownerId === membership.userId){
            throw TenancyError.CannotRemoveOwner();
        }

        await membership.remove();
    }

    async #get(orgId: number, membershipId: number): Promise<OrganizationMembership>{
        const membership = await OrganizationMembership.findOneBy({ id: membershipId, organizationId: orgId });
        if(!membership) throw TenancyError.MembershipNotFound();
        return membership;
    }

    #toMember(membership: OrganizationMembership, user: User): Member{
        return {
            id: membership.id,
            userId: user.id,
            username: user.username,
            fullname: user.fullname,
            email: user.email,
            role: membership.role,
            createdAt: membership.createdAt.toISOString(),
            updatedAt: membership.updatedAt.toISOString()
        };
    }
}
