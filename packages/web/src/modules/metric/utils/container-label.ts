import type { MonitoredContainer } from '@quantum/contracts/modules/metric/domain';

export const containerLabel = (container: MonitoredContainer): string =>
    container.service === null ? container.app : `${container.app} · ${container.service}`;
