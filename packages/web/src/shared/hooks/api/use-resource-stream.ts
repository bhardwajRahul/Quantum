import { useCallback, useEffect, useRef } from 'react';
import { invalidateCache } from 'alova';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import { queryCache } from '@/shared/hooks/api/query-cache';
import type { ResourceChangedFrame } from '@quantum/contracts/modules/resource/gateway';

const SEGMENT_BY_ENTITY: Readonly<Record<string, string>> = {
    ActivityEvent: 'activity',
    AnalyticsEvent: 'analytics',
    AnalyticsRollup: 'analytics',
    Database: 'database',
    Deployment: 'deployment',
    DockerContainer: 'docker',
    DockerImage: 'docker',
    DockerNetwork: 'docker',
    Domain: 'domain',
    Environment: 'project',
    HealthCheck: 'health-check',
    Job: 'deployment',
    Metric: 'metric',
    OrganizationMembership: 'organization',
    PortBinding: 'repository',
    Project: 'project',
    Repository: 'repository',
    Template: 'template',
    TemplateInstall: 'template'
};

const COALESCE_MS = 1_000;

export const useResourceStream = (): void => {
    const pending = useRef(new Set<string>());
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const flush = useCallback(() => {
        timer.current = undefined;
        const segments = [...pending.current];
        pending.current.clear();
        if(segments.length === 0) return;

        void (async () => {
            await invalidateCache();
            await Promise.all(segments.map((segment) => queryCache.invalidateSegment(segment)));
        })();
    }, []);

    const onChanged = useCallback((frame: ResourceChangedFrame) => {
        const segment = SEGMENT_BY_ENTITY[frame.entity];
        if(segment === undefined) return;

        pending.current.add(segment);
        if(timer.current === undefined) timer.current = setTimeout(flush, COALESCE_MS);
    }, [flush]);

    useEffect(() => () => {
        if(timer.current !== undefined) clearTimeout(timer.current);
    }, []);

    const { status, send } = useChannel('/resource/stream', { 'resource.changed': onChanged });

    useEffect(() => {
        if(status === 'open') send('subscribe');
    }, [status, send]);
};
