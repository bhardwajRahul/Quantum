import { InferSchemaType } from 'mongoose';
import { AnalyticsEventSchema } from '@models/analyticsEvent';

export type AnalyticsDevice = 'mobile' | 'desktop' | 'tablet' | 'bot';

export type IAnalyticsEvent = HydratedDocument<InferSchemaType<typeof AnalyticsEventSchema>>;
