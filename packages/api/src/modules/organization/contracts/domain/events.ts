export interface OrganizationCreatedPayload{
    organizationId: number;
    ownerId: number;
    name: string;
}

export interface OrganizationDeletedPayload{
    organizationId: number;
}
