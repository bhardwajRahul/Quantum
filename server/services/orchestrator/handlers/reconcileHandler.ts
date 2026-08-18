import DockerContainer from '@models/docker/container';
import Deployment from '@models/deployment';
import Job from '@models/job';
import Repository from '@models/repository';
import DockerContainerService from '@services/docker/container';
import { getDockerHost } from '@services/docker/host';
import logger from '@utilities/logger';
import { IJob } from '@typings/models/job';

const DEPLOY_LOCKING_JOB_TYPES = ['deploy', 'redeploy', 'build', 'reload', 'start', 'stop', 'restart'];

export const runReconcile = async (job: IJob): Promise<void> => {
    const nodeId = job.nodeId || 'local';
    const host = getDockerHost(nodeId);

    const desired = await DockerContainer.find({});
    let actualNames = new Set<string>();
    try{
        const actual = await host.listContainers({ all: true });
        actualNames = new Set(
            actual.flatMap((c) => (c.Names || []).map((n) => n.replace(/^\//, '')))
        );
    }catch(error){
        logger.error('@services/orchestrator/handlers/reconcileHandler.ts (runReconcile): cannot list containers: ' + error);
        throw error;
    }

    let recreated = 0;
    let started = 0;
    let skipped = 0;
    let raced = 0;

    for(const container of desired){
        const name = container.dockerContainerName;
        const present = name ? actualNames.has(name) : false;
        const desiredState = (container as any).desiredState || 'running';

        if(desiredState === 'stopped'){
            skipped++;
            continue;
        }

        if(container.repository){
            const inFlight = await Job.findOne({
                type: { $in: DEPLOY_LOCKING_JOB_TYPES },
                status: { $in: ['active', 'queued', 'delayed'] },
                'target.repository': container.repository
            }).select('_id');
            if(inFlight){
                raced++;
                continue;
            }
        }

        const service = new DockerContainerService(container);
        try{
            if(!present){

                let imageOverride: string | undefined;
                let extraLabels: Record<string, string> | undefined;
                if(container.repository){
                    const lastSuccess: any = await Deployment.findOne({
                        repository: container.repository,
                        status: 'success',
                        'artifact.tag': { $exists: true, $ne: '' }
                    }).sort({ createdAt: -1 }).select('artifact');
                    if(lastSuccess?.artifact?.tag){
                        imageOverride = lastSuccess.artifact.tag;
                        const repository = await Repository.findById(container.repository);
                        if(repository){

                            const { getIngressLabels } = await import('@services/ingress');
                            extraLabels = await getIngressLabels(repository).catch(() => ({}));
                        }
                    }
                }
                await service.createAndStartContainer({ imageOverride, extraLabels });

                await service.relaunchRepositoryApp();
                recreated++;
            }else{

                await service.start();
                started++;
            }
        }catch(error){
            logger.error(`@services/orchestrator/handlers/reconcileHandler.ts (runReconcile): failed reconciling ${name}: ${error}`);
        }
    }

    logger.info(`@services/orchestrator/handlers/reconcileHandler.ts (runReconcile): reconciled node ${nodeId} — recreated ${recreated}, started ${started}, left-stopped ${skipped}, raced ${raced}, total ${desired.length}.`);
};

export default runReconcile;
