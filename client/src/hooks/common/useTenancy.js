import { useSelector, useDispatch } from 'react-redux';
import { switchOrganization, switchProject } from '@services/tenancy/operations';

const useTenancy = () => {
    const dispatch = useDispatch();
    const {
        organizations, projects, organizationId, projectId, isLoading, error
    } = useSelector((state) => state.tenancy);

    const organization = organizations.find((o) => String(o._id) === String(organizationId)) || null;
    const project = projects.find((p) => String(p._id) === String(projectId)) || null;

    return {
        organizations,
        projects,
        organizationId,
        projectId,
        organization,
        project,
        isLoading,
        error,
        hasProject: !!projectId,
        selectOrganization: (id) => dispatch(switchOrganization(id)),
        selectProject: (id) => dispatch(switchProject(id))
    };
};

export default useTenancy;
