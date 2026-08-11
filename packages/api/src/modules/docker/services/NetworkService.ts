import DockerNetwork from '../models/DockerNetwork';

export default class NetworkService{
    async list(): Promise<DockerNetwork[]>{
        return DockerNetwork.find({ order: { id: 'ASC' } });
    }
}
