import { useCallback, useEffect, useRef } from 'react';
import { invalidateCache } from 'alova';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import { queryCache } from '@/shared/hooks/api/query-cache';
import type { ResourceChangedFrame } from '@quantum/contracts/modules/resource/gateway';

/**
 * Entity class name to the query-cache segment its lists live under. A segment is the
 * first static part of a module's route paths, which is what `segmentOf` derives and
 * what `invalidateSegment` matches on, so this table is the join between the two.
 *
 * An entity absent from here is simply not reflected on screen — the frame is dropped
 * rather than guessed at, because invalidating the wrong segment would refetch lists
 * that had no reason to change.
 */
const SEGMENT_BY_ENTITY: Readonly<Record<string, string>> = {
    ActivityEvent: 'activity',
    AnalyticsEvent: 'analytics',
    AnalyticsRollup: 'analytics',
    Codespace: 'codespace',
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

/**
 * How long changes are gathered before the affected segments are refetched. Every
 * organization-scoped row is announced, and a running container writes a `Metric` every
 * few seconds, so without a window each of those would cost a round trip per open tab.
 * Coalescing also collapses the burst a single deploy produces — Job, Deployment,
 * DockerContainer and PortBinding all land together — into one refetch per segment.
 */
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
            // The GET cache would otherwise answer the refetch with the body the write
            // just invalidated, exactly as it did before `fresh` was fixed.
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

    // The server only joins the caller's organization rooms once it is asked to.
    useEffect(() => {
        if(status === 'open') send('subscribe');
    }, [status, send]);
};
