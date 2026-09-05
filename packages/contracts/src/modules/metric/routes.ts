import { get } from '../../shared/routing';
import type { Metric } from './domain';

export const metricRoutes = {
    byRepository: get<Metric[]>('/metric/repository/:repositoryId')
};
