import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { toast } from 'sonner';
import useWebSocket from '@hooks/ws/useWebSocket';
import { activity as activityService } from '@services/platform/service';
import * as activitySlice from '@services/activity/slice';

const BACKFILL_LIMIT = 100;

const showToast = (event) => {
    if(!event) return;
    const { level, scope, title, message, meta } = event;
    const description = message || undefined;

    const isStepBeat = Number.isInteger(meta?.stepIndex);
    switch(level){
        case 'error':
            toast.error(title || 'Something went wrong', { description });
            return;
        case 'warn':
            toast.warning(title || 'Warning', { description });
            return;
        case 'success':

            if(scope === 'http' && Number(meta?.status) < 400) return;

            if(isStepBeat) return;
            toast.success(title || 'Done', { description });
            return;
        case 'progress':

            return;
        case 'info':
        default:

            return;
    }
};

const useActivityStream = (enabled = true) => {
    const dispatch = useDispatch();

    const [socket, isConnected] = useWebSocket(
        enabled ? { query: { action: 'Status::Stream' } } : { query: null }
    );

    useEffect(() => {
        if(!enabled) return;
        let active = true;
        (async () => {
            try{
                const res = await activityService.list({ query: { queryParams: { limit: BACKFILL_LIMIT } } });
                const arr = Array.isArray(res) ? res : (res?.data || []);
                if(active) dispatch(activitySlice.setActivities(arr));
            }catch{   }
        })();
        return () => { active = false; };
    }, [enabled, dispatch]);

    useEffect(() => {
        if(!enabled || !socket || !isConnected) return;
        const onActivity = (event) => {
            if(!event) return;
            dispatch(activitySlice.pushActivity(event));
            showToast(event);
        };
        socket.on('activity', onActivity);
        return () => {
            socket.off('activity', onActivity);
        };
    }, [enabled, socket, isConnected, dispatch]);
};

export default useActivityStream;
