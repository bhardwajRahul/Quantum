import DockerfileBuilder from '@services/build/dockerfileBuilder';
import PrebuiltImageBuilder from '@services/build/prebuiltImageBuilder';
import ExecBuilder from '@services/build/execBuilder';
import { detectBuildStrategy } from '@services/runtime/detect';
import { IRepository } from '@typings/models/repository';
import { BuilderStrategy, BuildContext, Artifact } from '@typings/services/build';

export type { BuilderStrategy, BuildContext, Artifact } from '@typings/services/build';

export const resolveStrategy = (repository: IRepository, files: string[] = [], pkg?: any): string => {
    const pinned = repository.buildStrategy;
    if(pinned && pinned !== 'auto') return pinned;
    const detected = detectBuildStrategy(files);

    if(detected === 'exec' && repository.image) return 'prebuilt-image';
    return detected;
};

export const getBuilder = (strategy: string): BuilderStrategy => {
    switch(strategy){
        case 'dockerfile':
            return new DockerfileBuilder();
        case 'prebuilt-image':
            return new PrebuiltImageBuilder();
        case 'exec':
            return new ExecBuilder();
        case 'compose':
        case 'nixpacks':
        case 'buildpacks':
            throw new Error(`Build::Strategy::NotYetImplemented::${strategy}`);
        default:
            throw new Error(`Build::Strategy::Unknown::${strategy}`);
    }
};

export default { resolveStrategy, getBuilder };
