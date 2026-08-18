import { getUserByToken } from '@middlewares/authentication';
import { ISocket, WsNextFunction } from '@typings/controllers/wsController';
import RuntimeError from '@utilities/runtimeError';
import DockerContainerService from '@services/docker/container';
import Repository from '@models/repository';
import DockerContainer from '@models/docker/container';
import { streamReadable } from '@services/logManager';
import { getDockerHost } from '@services/docker/host';
import logger from '@utilities/logger';

const authenticateUser = async (socket: ISocket, next: WsNextFunction) => {
    const cookies = socket.request.headers.cookie;
    const jwtCookie = cookies
        ?.split('; ')
        .find((cookie) => cookie.startsWith('jwt='))
        ?.split('=')[1];
    if(!jwtCookie) return next(new RuntimeError('Authentication::Token::Required', 400));
    try{
        socket.user = await getUserByToken(jwtCookie);
        next();
    }catch(error){
        next(error);
    }
};

const checkRepositoryOwnership = async (socket: ISocket, next: WsNextFunction) => {
    const { repositoryAlias } = socket.handshake.query;
    if(!repositoryAlias) return next(new RuntimeError('Repository::Name::Required', 400));
    try{
        const repository = await Repository.findOne({ alias: repositoryAlias, user: socket.user._id });
        if(!repository) return next(new RuntimeError('Repository::Not::Found', 404));
        socket.repository = repository;
        next();
    }catch(error){
        next(error);
    }
};

const handleDockerShell = async (socket: ISocket) => {
    try{
        let dockerContainer;
        let workDir = '/';
        if(socket.repository){
            dockerContainer = await DockerContainer.findOne({ repository: socket.repository });
            workDir = `/app/${socket.repository.rootDirectory}`;
        }else{
            const { dockerId } = socket.handshake.query;
            dockerContainer = await DockerContainer.findOne({ _id: dockerId, user: socket.user._id });
        }
        if(dockerContainer){
            const dockerHandler = new DockerContainerService(dockerContainer);
            dockerHandler.startSocketShell(socket, workDir);
        }
    }catch(error){
        logger.info('@controllers/wsController.ts (handleDockerShell): ' + error);
    }
};

const handleCloudConsole = async (socket: ISocket) => {
    try{
        const container = await DockerContainer.findById(socket.user.container);
        if(!container) return;
        const containerService = new DockerContainerService(container);
        await containerService.startSocketShell(socket, '/');
    }catch (error){
        logger.error('@controllers/wsController.ts (handleCloudConsole): ' + error);
    }
};

const handleContainerLogs = async (socket: ISocket) => {
    try{
        const { dockerId } = socket.handshake.query;
        const container = socket.repository
            ? await DockerContainer.findOne({ repository: socket.repository })
            : await DockerContainer.findOne({ _id: dockerId, user: socket.user._id });
        if(!container) return;
        const host = getDockerHost((container as any).nodeId || 'local');
        const dockerContainer = host.getContainer(container.dockerContainerName);
        const logStream = await dockerContainer.logs({
            follow: true, stdout: true, stderr: true, tail: 200
        }) as unknown as NodeJS.ReadableStream;
        const userId = socket.user._id.toString();
        const logId = container._id.toString();

        await streamReadable(socket, userId, logId, logStream, { demux: true });
    }catch(error){
        logger.error('@controllers/wsController.ts (handleContainerLogs): ' + error);
    }
};

export default (io: any) => {
    io.use(authenticateUser);
    io.on('connection', async (socket: ISocket) => {
        socket.emit('connected');

        if(socket.user?._id){
            socket.join(`user:${socket.user._id.toString()}`);
        }
        const { action } = socket.handshake.query;
        switch(action){
            case 'Repository::Shell':
                await checkRepositoryOwnership(socket, async (error) => {
                    if(!error) handleDockerShell(socket);
                    else logger.error('@controllers/wsController.ts (default): ', error);
                });
                break;
            case 'Cloud::Console':
                handleCloudConsole(socket);
                break;
            case 'DockerContainer::Shell':
                handleDockerShell(socket);
                break;
            case 'Status::Stream':

                break;
            case 'Container::Logs':
                if(socket.handshake.query.repositoryAlias){
                    await checkRepositoryOwnership(socket, async (error) => {
                        if(!error) handleContainerLogs(socket);
                    });
                }else{
                    handleContainerLogs(socket);
                }
                break;
            default:
                socket.disconnect();
        }
    });
};
