import { InferSchemaType } from 'mongoose';
import { AnalyticsRollupSchema } from '@models/analyticsRollup';

export type IAnalyticsRollup = HydratedDocument<InferSchemaType<typeof AnalyticsRollupSchema>>;
