import { get, getWithQuery } from '../../shared/routing';
import type { MetricQuery } from './http';
import type { Metric, MonitoredContainer } from './domain';

export const metricRoutes = {
    containers: get<MonitoredContainer[]>('/metric/container'),
    byContainer: getWithQuery<MetricQuery, Metric[]>('/metric/container/:containerId')
};
