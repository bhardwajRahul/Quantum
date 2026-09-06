export interface ProjectCreatedPayload{
    projectId: number;
    organizationId: number;
    name: string;
}

export interface ProjectDeletedPayload{
    projectId: number;
    organizationId: number;
}
