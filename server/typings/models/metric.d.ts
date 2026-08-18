import { InferSchemaType } from 'mongoose';
import { MetricSchema } from '@models/metric';

export type IMetric = HydratedDocument<InferSchemaType<typeof MetricSchema>>;
