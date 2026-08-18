import Domain from '@models/domain';
import { getDockerHost } from '@services/docker/host';
import { EDGE_NETWORK_NAME } from '@services/docker/network';
import { buildTraefikLabels, resolveInternalPort } from '@services/ingress/labels';
import logger from '@utilities/logger';
import { IRepository } from '@typings/models/repository';

export const getIngressLabels = async (repository: IRepository): Promise<Record<string, string>> => {
    if(process.env.INGRESS_ENABLED === 'false') return {};
    const domains = await Domain.find({ repository: repository._id }).select('host tls status');
    if(!domains.length) return {};
    return buildTraefikLabels(repository, domains, resolveInternalPort(repository));
};

export const connectContainerToEdge = async (
    host: string = 'local',
    containerName: string
): Promise<void> => {
    if(!containerName) return;
    try{
        const network = getDockerHost(host).client().getNetwork(EDGE_NETWORK_NAME);
        await network.connect({ Container: containerName });
        logger.info(`@services/ingress (connectContainerToEdge): attached ${containerName} to ${EDGE_NETWORK_NAME}`);
    }catch(error: any){

        if(error?.statusCode === 403) return;
        logger.warn(`@services/ingress (connectContainerToEdge): ${containerName}: ${error?.message || error}`);
    }
};

export const ensureSubdomain = async (repository: IRepository): Promise<void> => {
    const baseDomain = process.env.BASE_DOMAIN;
    if(!baseDomain) return;
    const alias = repository.alias || (repository._id ? repository._id.toString() : '');
    if(!alias) return;
    const host = `${alias}.${baseDomain}`.toLowerCase();
    const existing = await Domain.findOne({ host });
    if(existing) return;

    await Domain.deleteMany({
        repository: repository._id,
        kind: 'subdomain',
        host: { $ne: host }
    });
    const isFirst = (await Domain.countDocuments({ repository: repository._id })) === 0;
    await Domain.create({
        repository: repository._id,
        organization: repository.organization,
        project: repository.project,
        user: repository.user,
        host,
        kind: 'subdomain',
        isPrimary: isFirst,
        tls: true,
        status: 'pending'
    });
    logger.info(`@services/ingress (ensureSubdomain): provisioned ${host} for repository ${repository._id}`);
};

export default {
    getIngressLabels,
    connectContainerToEdge,
    ensureSubdomain
};
