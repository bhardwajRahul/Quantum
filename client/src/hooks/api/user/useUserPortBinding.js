import useUserResource from './useUserResource';
import { getMyPortBindings } from '@services/portBinding/operations';
import { setState as portBindingSetState } from '@services/portBinding/slice';

const useUserPortBinding = () => useUserResource({
    slice: 'portBinding',
    dataKey: 'portBindings',
    operation: getMyPortBindings,
    setState: portBindingSetState,
    cleanupPath: 'portBindings',
    initialPage: undefined,
    extraKeys: ['portBindingStats']
});

export default useUserPortBinding;
