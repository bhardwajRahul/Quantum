import useUserResource from './useUserResource';
import { getMyDockerContainers } from '@services/docker/container/operations';
import { setState as dockerContSetState } from '@services/docker/container/slice';

const useUserDockerContainers = () => useUserResource({
    slice: 'dockerContainer',
    dataKey: 'dockerContainers',
    operation: getMyDockerContainers,
    setState: dockerContSetState,
    cleanupPath: 'containers'
});

export default useUserDockerContainers;
