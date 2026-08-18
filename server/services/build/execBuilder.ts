import { BuilderStrategy, BuildContext, Artifact } from '@typings/services/build';

class ExecBuilder implements BuilderStrategy{
    async build(_ctx: BuildContext): Promise<Artifact>{
        return { image: '', tag: '', digest: '', builder: 'exec', sizeBytes: 0 };
    }
}

export default ExecBuilder;
