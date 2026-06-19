import Docker from 'dockerode';
import prompts from 'prompts';
const docker = new Docker();

const aliases = ['quantum-container', 'quantum-network'];

export const filterAvailableContainers = async (activeOnly: boolean = false): Promise<any[]> => {
    const containers = await docker.listContainers({ all: !activeOnly });
    return containers
        .filter((containerInfo) => {
            const containerName = containerInfo.Names[0];
            return aliases.some((alias) => containerName
                .startsWith(`/${alias}`)) && (!activeOnly || containerInfo.State === 'running');
        });
};

export const filterAvailableNetworks = async (): Promise<any[]> => {
    const networks = await docker.listNetworks();
    return networks.filter((networkInfo) => aliases.some((alias) => networkInfo.Name.startsWith(alias)));
};

export const removeContainers = async (containers: any[]): Promise<void> => {
    for(const container of containers){
        try{
            const cont = docker.getContainer(container.Id);
            await cont.remove({ force: true });
            console.log(`Deleted container: ${container.Names[0]}`);
        }catch(error){
            console.error(`Error for container ${container.Names[0]}:`, error);
        }
    }
};

export const removeNetworks = async (networks: any[]): Promise<void> => {
    for(const network of networks){
        try{
            const net = docker.getNetwork(network.Id);
            const networkDetails = await net.inspect();
            const containers = networkDetails.Containers;
            if(containers){
                for(const containerId in containers){
                    try{
                        await net.disconnect({ Container: containerId, Force: true });
                        console.log(`Container ${containerId} disconnected from network ${network.Name}`);
                    }catch (error){
                        console.error(`Error disconnecting container ${containerId}:`, error);
                    }
                }
            }
            await net.remove();
            console.log(`Deleted: ${network.Name}`);
        }catch(error){
            console.error(`Error for ${network.Name}:`, error);
        }
    }
};

/**
 * Shared "list → confirm → bulk-remove" CLI flow used by removeContainers and
 * removeCreatedNetworks. Caller supplies how to fetch, how to label each item, the
 * `quantum-*-${environment}` prefix, and the actual removal call.
 */
export const promptAndRemoveByEnvironment = async (config: {
    fetch: () => Promise<any[]>;
    nameOf: (item: any) => string;
    prefix: string;            // e.g. '/quantum-container-' or 'quantum-network-'
    label: string;             // 'containers' | 'networks'
    remove: (items: any[]) => Promise<void>;
}): Promise<void> => {
    const items = await config.fetch();
    if(!items.length){
        console.log(`There are no ${config.label} created.`);
        return;
    }
    const { environment } = await prompts({
        type: 'select',
        name: 'environment',
        message: `What ${config.label} do you want to delete?`,
        choices: [
            { title: 'All those that have been created in production.', value: 'production' },
            { title: 'Those created in development.', value: 'development' },
        ]
    });
    const filtered = items.filter((i) => config.nameOf(i).startsWith(`${config.prefix}${environment}`));
    filtered.forEach((item, i) => console.log(`${i + 1}) ${config.nameOf(item)}`));
    console.log(`\n${filtered.length} ${config.label} have been found.`);
    const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'This cannot be undone. Do you want to continue?'
    });
    if(confirm){
        await config.remove(filtered);
        console.log(`All ${config.label} were removed.`);
        return;
    }
    console.log(`No ${config.label} were removed.`);
};
