import { useEffect, useRef, useState } from 'react';
import useWebSocket from '@hooks/ws/useWebSocket';
import { activity as activityService } from '@services/platform/service';

const STATUS_RANK = { progress: 0, info: 1, success: 2, warn: 2, error: 3 };

const mergeStep = (map, event) => {
    const idx = Number.isInteger(event?.meta?.stepIndex) ? event.meta.stepIndex : null;
    if(idx === null) return;
    const prev = map.get(idx);

    if(prev && STATUS_RANK[event.level] < STATUS_RANK[prev.level]) return;
    map.set(idx, {
        stepIndex: idx,
        title: event.title,
        level: event.level,
        message: event.message,
        durationMs: event.meta?.durationMs,
        ts: event.ts
    });
};

const useDeploymentPipeline = (jobId, enabled = true) => {
    const [steps, setSteps] = useState([]);
    const stepMapRef = useRef(new Map());
    const [socket, isConnected] = useWebSocket(
        enabled && jobId ? { query: { action: 'Status::Stream' } } : { query: null }
    );

    const flush = () => {
        const arr = Array.from(stepMapRef.current.values()).sort((a, b) => a.stepIndex - b.stepIndex);
        setSteps(arr);
    };

    useEffect(() => {
        stepMapRef.current = new Map();
        setSteps([]);
        if(!enabled || !jobId) return undefined;
        let active = true;
        (async () => {
            try{
                const res = await activityService.list({ query: { queryParams: { correlationId: jobId, limit: 200 } } });
                const arr = Array.isArray(res) ? res : (res?.data || []);
                if(!active) return;
                for(const event of arr) mergeStep(stepMapRef.current, event);
                flush();
            }catch{   }
        })();
        return () => { active = false; };
    }, [jobId, enabled]);

    useEffect(() => {
        if(!enabled || !jobId || !socket || !isConnected) return undefined;
        const onActivity = (event) => {
            if(!event || String(event.correlationId) !== String(jobId)) return;
            mergeStep(stepMapRef.current, event);
            flush();
        };
        socket.on('activity', onActivity);
        return () => { socket.off('activity', onActivity); };
    }, [jobId, enabled, socket, isConnected]);

    return steps;
};

export default useDeploymentPipeline;
