import type { BuilderStrategy, BuildContext } from './BuildContext';
import type { DeploymentArtifact } from '@quantum/contracts/modules/deployment/domain';

export default class ExecBuilder implements BuilderStrategy{
    async build(_ctx: BuildContext): Promise<DeploymentArtifact>{
        return { image: '', tag: '', digest: '', builder: 'exec', sizeBytes: 0 };
    }
}
