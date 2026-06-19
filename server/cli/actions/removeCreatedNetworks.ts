import { removeNetworks, filterAvailableNetworks, promptAndRemoveByEnvironment } from '@cli/utilities/docker';

export const removeCreatedNetworks = (): Promise<void> =>
    promptAndRemoveByEnvironment({
        fetch: filterAvailableNetworks,
        nameOf: (n) => n.Name,
        prefix: 'quantum-network-',
        label: 'networks',
        remove: removeNetworks,
    });

export default removeCreatedNetworks;
