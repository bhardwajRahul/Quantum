import TemplateInstall from '@models/templateInstall';
import DockerContainer from '@models/docker/container';
import DockerContainerService from '@services/docker/container';
import { parseCompose } from '@services/templates/compose';
import { ensureInstallInfra, collectPortBindings } from '@services/templates/installer';
import { resolveEnv } from '@services/templates/interpolate';
import { encrypt } from '@utilities/encryption';
import { IUser } from '@typings/models/user';
import { IOneClickDeployConfig } from '@typings/services/oneClickDeploy';
import { IDockerContainer } from '@typings/models/docker/container';

export const parseConfigAndDeploy = async (
    user: IUser,
    config: IOneClickDeployConfig,
    scope: { organization: any; project: any }
): Promise<IDockerContainer | null> => {

    const spec = parseCompose(config);
    const parentName = config.name;

    const install = await TemplateInstall.create({
        name: config.name,
        templateVersion: 'legacy',
        user: user._id,
        organization: scope.organization,
        project: scope.project,
        nodeId: process.env.NODE_ID || 'local',
        status: 'installing',
        inputs: new Map<string, string>([['__spec__', encrypt(JSON.stringify(spec))]])
    });

    const containers = await ensureInstallInfra(install, spec);

    const ports = await collectPortBindings(containers);
    const resolved = resolveEnv(spec, {}, ports);
    let parent: IDockerContainer | null = null;
    for(const [serviceName, container] of Object.entries(containers)){
        const variables = resolved[serviceName];
        if(variables && Object.keys(variables).length > 0){
            const updated = await DockerContainer.findOneAndUpdate(
                { _id: container._id },
                { environment: { variables } },
                { new: true }
            );
            if(updated){
                await new DockerContainerService(updated).reloadContainer();
            }
            if(serviceName === parentName) parent = updated as IDockerContainer;
        }else if(serviceName === parentName){
            parent = container;
        }
    }

    install.status = 'running';
    await install.save();

    return parent || (await DockerContainer.findById(containers[parentName]?._id));
};

export default { parseConfigAndDeploy };
