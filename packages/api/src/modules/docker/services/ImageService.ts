import DockerImage from '../models/DockerImage';

export default class ImageService{
    async list(): Promise<DockerImage[]>{
        return DockerImage.find({ order: { id: 'ASC' } });
    }
}
