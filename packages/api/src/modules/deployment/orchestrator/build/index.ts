import DockerfileBuilder from './DockerfileBuilder';
import PrebuiltImageBuilder from './PrebuiltImageBuilder';
import ExecBuilder from './ExecBuilder';
import { BuildStrategy } from '@quantum/contracts/modules/repository/domain';
import type { BuilderStrategy } from './BuildContext';

interface StrategySource{
    buildStrategy: BuildStrategy;
    image: string | null;
}

export const detectBuildStrategy = (files: string[]): string => {
    if(files.includes('Dockerfile')) return BuildStrategy.Dockerfile;
    return BuildStrategy.Exec;
};

export const resolveStrategy = (repository: StrategySource, files: string[] = []): string => {
    const pinned = repository.buildStrategy;
    if(pinned && pinned !== BuildStrategy.Auto) return pinned;
    const detected = detectBuildStrategy(files);
    if(detected === BuildStrategy.Exec && repository.image) return BuildStrategy.PrebuiltImage;
    return detected;
};

export const getBuilder = (strategy: string): BuilderStrategy => {
    switch(strategy){
        case BuildStrategy.Dockerfile:
            return new DockerfileBuilder();
        case BuildStrategy.PrebuiltImage:
            return new PrebuiltImageBuilder();
        case BuildStrategy.Exec:
            return new ExecBuilder();
        default:
            throw new Error(`Build::Strategy::Unknown::${strategy}`);
    }
};
