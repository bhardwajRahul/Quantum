import { InferSchemaType } from 'mongoose';
import { ActivityEventSchema } from '@models/activityEvent';

export type ActivityLevel = 'info' | 'success' | 'progress' | 'warn' | 'error';

export type IActivityEvent = HydratedDocument<InferSchemaType<typeof ActivityEventSchema>>;
