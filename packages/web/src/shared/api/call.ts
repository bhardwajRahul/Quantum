import { alova } from '@/shared/api/alova';
import type { RequestBody } from 'alova';
import type { Endpoint } from '@quantum/contracts/shared/routing';
import { defineErrors } from '@/shared/errors/define-errors';
import type { CallOptions, PathValues } from '@/shared/contracts/api';

const CallError = defineErrors({
    domain: 'Call',
    causes: {
        MissingPathParam: 500
    }
} as const);

const interpolatePath = (path: string, values: PathValues = {}): string =>
    path.replace(/:(\w+)/g, (_, name: string) => {
        const value = values[name];
        if(value === undefined) throw CallError.MissingPathParam(`${name}@${path}`);
        return encodeURIComponent(value);
    });

const methodFor = <I, O>(endpoint: Endpoint<I, O>, url: string, options: CallOptions<I>) => {
    const config = options.query ? { params: options.query as Record<string, unknown> } : {};
    const body = options.body as RequestBody | undefined;

    switch(endpoint.method){
        case 'POST': return alova.Post<O>(url, body, config);
        case 'PATCH': return alova.Patch<O>(url, body, config);
        case 'PUT': return alova.Put<O>(url, body, config);
        case 'DELETE': return alova.Delete<O>(url, body, config);
        default: return alova.Get<O>(url, config);
    }
};

export const call = <I, O>(endpoint: Endpoint<I, O>, options: CallOptions<I> = {}) => {
    const method = methodFor(endpoint, interpolatePath(endpoint.path, options.path), options);

    return options.fresh ? method.send(true) : method;
};
