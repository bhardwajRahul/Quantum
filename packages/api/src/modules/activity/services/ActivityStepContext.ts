import ActivityService from './ActivityService';
import { ActivityLevel } from '@quantum/contracts/modules/activity/domain';

export interface ActivityStepContextParams{
    organizationId: number | null;
    userId: number | null;
    scope: string;
    source: string;
    correlationId: string;
}

export default class ActivityStepContext{
    #service = new ActivityService();
    #params: ActivityStepContextParams;
    #stepIndex = 0;

    constructor(params: ActivityStepContextParams){
        this.#params = params;
    }

    async step<T>(title: string, fn: () => Promise<T>): Promise<T>{
        const stepIndex = this.#stepIndex++;
        const startedAt = Date.now();
        await this.#emit(title, ActivityLevel.Progress, '', { stepIndex });
        try{
            const result = await fn();
            await this.#emit(title, ActivityLevel.Success, '', { stepIndex, durationMs: Date.now() - startedAt });
            return result;
        }catch(error){
            const message = error instanceof Error ? error.message : String(error);
            await this.#emit(title, ActivityLevel.Error, message, { stepIndex, durationMs: Date.now() - startedAt });
            throw error;
        }
    }

    async progress(title: string): Promise<void>{
        await this.#emit(title, ActivityLevel.Progress, '', { stepIndex: this.#stepIndex++ });
    }

    async success(title: string): Promise<void>{
        await this.#emit(title, ActivityLevel.Success, '', { stepIndex: this.#stepIndex++ });
    }

    async fail(title: string, message: string): Promise<void>{
        await this.#emit(title, ActivityLevel.Error, message, { stepIndex: this.#stepIndex++ });
    }

    #emit(title: string, level: ActivityLevel, message: string, meta: Record<string, unknown>): Promise<unknown>{
        return this.#service.create({
            organizationId: this.#params.organizationId,
            userId: this.#params.userId,
            scope: this.#params.scope,
            level,
            title,
            message,
            source: this.#params.source,
            correlationId: this.#params.correlationId,
            meta
        });
    }
}
