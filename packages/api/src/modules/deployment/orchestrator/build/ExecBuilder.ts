import ContainerOps from '../ContainerOps';
import { checkoutRepository } from './SourceCheckout';
import { emitBuildLog } from './BuildContext';
import type { BuilderStrategy, BuildContext } from './BuildContext';
import type { DeploymentArtifact } from '@quantum/contracts/modules/deployment/domain';

const workingDirFor = (rootDirectory: string): string => {
    const suffix = rootDirectory === '' || rootDirectory === '/' ? '' : rootDirectory;
    return `/app${suffix}`;
};

/**
 * Builds in place, inside the container that will run the app.
 *
 * This used to return an empty artifact and do nothing at all, so an `exec` deployment
 * reported success while `/app` stayed empty and the start command died immediately —
 * a published port that reset every connection because nothing was ever behind it.
 *
 * The work is split by what each side actually has: the API holds git and the shared
 * volume, so it fetches the code; the container holds the runtime, so it installs and
 * builds.
 */
export default class ExecBuilder implements BuilderStrategy{
    async build(ctx: BuildContext): Promise<DeploymentArtifact>{
        const { repository, deployment, container } = ctx;
        if(container === null || !container.storagePath){
            throw new Error('Build::Exec::Container::Required');
        }

        emitBuildLog(deployment, `[source] Fetching ${repository.branch} from ${repository.url}\n`);
        const checkout = await checkoutRepository(
            container.storagePath,
            repository.url,
            repository.branch,
            repository.userId
        );
        emitBuildLog(deployment, `[source] ${checkout.commit.slice(0, 7)} ${checkout.subject}\n`);

        // Recording the commit here is what fills the column that used to read "—".
        deployment.commit = {
            message: checkout.subject,
            author: { name: checkout.author, email: '' },
            date: checkout.date
        };
        await deployment.save();

        const ops = new ContainerOps(container);

        /*
         * `exec` needs a running container. Asserting it here rather than trusting the
         * caller keeps the builder correct on its own: a stopped container fails every
         * exec with a 409 that says nothing about the build.
         */
        await ops.start();

        const cwd = workingDirFor(repository.rootDirectory);

        await this.#step(ops, deployment, cwd, 'install', repository.installCommand);
        await this.#step(ops, deployment, cwd, 'build', repository.buildCommand);

        emitBuildLog(deployment, '[run] Starting the application\n');
        await ops.relaunchRepositoryApp();

        return { image: '', tag: '', digest: checkout.commit, builder: 'exec', sizeBytes: 0 };
    }

    async #step(ops: ContainerOps, deployment: BuildContext['deployment'], cwd: string, label: string, command: string): Promise<void>{
        if(command.trim() === '') return;

        emitBuildLog(deployment, `[${label}] ${command}\n`);
        const result = await ops.executeCommand(command, { WorkingDir: cwd });
        if(result.output) emitBuildLog(deployment, result.output);

        if(result.exitCode !== 0){
            throw new Error(`The ${label} command failed with exit code ${result.exitCode}: ${command}`);
        }
    }
}
