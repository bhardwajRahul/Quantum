import { createSlice } from '@reduxjs/toolkit';

const MAX_EVENTS = 200;

const initialState = {
    events: [],
    unread: 0
};

const activitySlice = createSlice({
    name: 'activity',
    initialState,
    reducers: {

        pushActivity(state, action){
            const event = action.payload;
            if(!event) return;
            state.events.unshift(event);
            if(state.events.length > MAX_EVENTS){
                state.events.length = MAX_EVENTS;
            }
            state.unread += 1;
        },

        setActivities(state, action){
            const incoming = Array.isArray(action.payload) ? action.payload : [];
            const keyOf = (e) => e?._id || e?.correlationId || `${e?.ts}-${e?.title}`;
            const merged = new Map();
            for(const e of state.events) merged.set(keyOf(e), e);
            for(const e of incoming) merged.set(keyOf(e), e);
            const arr = Array.from(merged.values());
            arr.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
            state.events = arr.slice(0, MAX_EVENTS);
        },

        clearUnread(state){
            state.unread = 0;
        }
    }
});

export const { pushActivity, setActivities, clearUnread } = activitySlice.actions;

export default activitySlice.reducer;
