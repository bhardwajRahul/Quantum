import { getWithQuery } from '../../shared/routing';
import type { Metric } from './domain';
import type { MetricQuery } from './http';

export const metricRoutes = {
    byRepository: getWithQuery<MetricQuery, Metric[]>('/metric/repository/:repositoryId')
};
