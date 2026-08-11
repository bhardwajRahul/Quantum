export interface TenantState{
    currentOrganizationId: number | null;
    setOrganizationId: (organizationId: number) => void;
    clear: () => void;
}
