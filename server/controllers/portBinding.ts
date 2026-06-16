import PortBinding from '@models/portBinding';
import HandlerFactory from '@controllers/common/handlerFactory';
import { enqueueReload } from '@services/orchestrator';
import logger from '@utilities/logger';
import { IRequest } from '@typings/controllers/common';

const PortBindingFactory = new HandlerFactory({
    model: PortBinding,
    scope: { field: 'organization' },
    fields: [
        'internalPort',
        'externalPort',
        'protocol',
        'container'
    ]
});

// ADR-0001: adding/removing a port binding used to recreate the container inside
// the model hooks. The reload is now a durable job enqueued here after the
// mutation (best-effort; never blocks the response). The container must be
// recreated so the published/unpublished port takes effect.
const reloadBindingContainer = async (req: IRequest, data: any) => {
    const containerId = data?.container?.toString();
    if(containerId){
        enqueueReload(containerId, { userId: (req.user as any)?._id?.toString() }).catch((error) =>
            logger.warn('@controllers/portBinding.ts (reloadBindingContainer): reload enqueue failed: ' + error));
    }
    return data;
};

// Stamp the owning user from the authenticated session, not the request body:
// the create form only sends { internalPort, externalPort, container }, and the
// model requires `user`. Without this, POST /port-binding fails with
// PortBinding::User::Required. (organization is already stamped by the scope.)
const stampUser = (req: IRequest, data: any) => {
    data.user = (req.user as any)?._id;
    return data;
};

export const getPortBindings = PortBindingFactory.getAll();
export const getPortBinding = PortBindingFactory.getOne();
export const createPortBinding = PortBindingFactory.createOne({ middlewares: { pre: [stampUser], post: [reloadBindingContainer] } });
export const updatePortBinding = PortBindingFactory.updateOne();
export const deletePortBinding = PortBindingFactory.deleteOne({ middlewares: { post: [reloadBindingContainer] } });

export const getMyPortBindings = PortBindingFactory.getAll({
    middlewares: {
        pre: [(req, query) => {
            query.user = req.user;
            return query;
        }]
    }
});