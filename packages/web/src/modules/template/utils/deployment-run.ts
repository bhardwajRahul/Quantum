import type { ActivityEvent } from '@quantum/contracts/modules/activity/domain';

export const latestRun = (events: ActivityEvent[]): ActivityEvent[] => {
    const run = events.find((event) => event.correlationId !== null)?.correlationId;
    if(run === undefined) return [];
    const steps = new Map<string, ActivityEvent>();
    for(const event of events.filter((entry) => entry.correlationId === run)){
        const key = String(event.meta.stepIndex ?? event.id);
        if(!steps.has(key)) steps.set(key, event);
    }
    return [...steps.values()].sort((a, b) => Number(a.meta.stepIndex ?? 0) - Number(b.meta.stepIndex ?? 0));
};
