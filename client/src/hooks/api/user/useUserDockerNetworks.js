import useUserResource from './useUserResource';
import { getMyDockerNetworks } from '@services/docker/network/operations';
import { setState as dockerNetSetState } from '@services/docker/network/slice';

const useUserDockerNetworks = () => useUserResource({
    slice: 'dockerNetwork',
    dataKey: 'dockerNetworks',
    operation: getMyDockerNetworks,
    setState: dockerNetSetState,
    cleanupPath: 'networks'
});

export default useUserDockerNetworks;
