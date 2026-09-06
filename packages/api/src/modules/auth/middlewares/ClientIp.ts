import { createParamDecorator } from '@/shared/controllers/params';

export const ClientIp = (): ParameterDecorator => createParamDecorator((req) => req.ip);
