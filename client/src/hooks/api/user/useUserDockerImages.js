import useUserResource from './useUserResource';
import { getMyDockerImages } from '@services/docker/image/operations';
import { setState as dockerImgSetState } from '@services/docker/image/slice';

const useUserDockerImages = () => useUserResource({
    slice: 'dockerImage',
    dataKey: 'dockerImages',
    operation: getMyDockerImages,
    setState: dockerImgSetState,
    cleanupPath: 'images'
});

export default useUserDockerImages;
