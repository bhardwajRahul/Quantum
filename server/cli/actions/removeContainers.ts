import { removeContainers, filterAvailableContainers, promptAndRemoveByEnvironment } from '@cli/utilities/docker';

export const removeCreatedContainers = (): Promise<void> =>
    promptAndRemoveByEnvironment({
        fetch: filterAvailableContainers,
        nameOf: (c) => c.Names[0],
        prefix: '/quantum-container-',
        label: 'containers',
        remove: removeContainers,
    });

export default removeCreatedContainers;
