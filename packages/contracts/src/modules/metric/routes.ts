import { get } from '../../shared/routing';
import type { Metric } from './domain';

export const metricRoutes = {
    byContainer: get<Metric[]>('/metric/container/:containerId'),
    byRepository: get<Metric[]>('/metric/repository/:repositoryId')
};
