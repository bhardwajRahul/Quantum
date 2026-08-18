import { organizations as orgsApi, projects as projectsApi } from '@services/platform/service';
import {
    setOrganizations, setProjects, selectOrganization, selectProject,
    setLoading, setError
} from '@services/tenancy/slice';

const asArray = (res) => (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
const idOf = (x) => String(x?._id || x?.id || '');

export const loadProjects = (orgId, preferredProjectId) => async (dispatch) => {
    if(!orgId){
        dispatch(setProjects([]));
        dispatch(selectProject(''));
        return [];
    }
    try{
        const res = await projectsApi.listByOrg({ query: { params: { orgId } } });
        const list = asArray(res);
        dispatch(setProjects(list));

        const ids = list.map(idOf);
        let chosen = '';
        if(preferredProjectId && ids.includes(String(preferredProjectId))){
            chosen = String(preferredProjectId);
        }else{
            const def = list.find((p) => p.isDefault);
            chosen = def ? idOf(def) : (list[0] ? idOf(list[0]) : '');
        }
        dispatch(selectProject(chosen));
        return list;
    }catch(err){
        dispatch(setProjects([]));
        dispatch(selectProject(''));
        dispatch(setError(typeof err === 'string' ? err : (err?.message || 'Failed to load projects.')));
        return [];
    }
};

export const bootstrapTenancy = (persisted = {}) => async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try{
        const res = await orgsApi.list({});
        const orgs = asArray(res);
        dispatch(setOrganizations(orgs));

        if(orgs.length === 0){
            dispatch(selectOrganization(''));
            dispatch(setProjects([]));
            return;
        }

        const ids = orgs.map(idOf);
        let orgId = '';
        if(persisted.organizationId && ids.includes(String(persisted.organizationId))){
            orgId = String(persisted.organizationId);
        }else{
            const personal = orgs.find((o) => o.isPersonal);
            orgId = personal ? idOf(personal) : idOf(orgs[0]);
        }
        dispatch(selectOrganization(orgId));
        await dispatch(loadProjects(orgId, persisted.projectId));
    }catch(err){
        dispatch(setError(typeof err === 'string' ? err : (err?.message || 'Failed to load organizations.')));
    }finally{
        dispatch(setLoading(false));
    }
};

export const switchOrganization = (orgId) => async (dispatch) => {
    dispatch(selectOrganization(orgId));
    await dispatch(loadProjects(orgId));
};

export const switchProject = (projectId) => (dispatch) => {
    dispatch(selectProject(projectId));
};
