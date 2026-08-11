export class ClientError extends Error{
    constructor(code: string){
        super(code);
        this.name = 'ClientError';
    }
}
