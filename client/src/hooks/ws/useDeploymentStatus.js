import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useWebSocket from '@hooks/ws/useWebSocket';
import * as repositorySlice from '@services/repository/slice';

const useDeploymentStatus = (enabled = true) => {
    const dispatch = useDispatch();

    const [socket, isConnected] = useWebSocket(
        enabled ? { query: { action: 'Status::Stream' } } : { query: null }
    );

    useEffect(() => {
        if(!enabled || !socket || !isConnected) return;
        const onStatus = ({ repositoryId, status }) => {
            if(!repositoryId || !status) return;
            dispatch(repositorySlice.updateRepositories({
                repository: { _id: repositoryId },
                status
            }));
        };
        socket.on('deployment:status', onStatus);
        return () => {
            socket.off('deployment:status', onStatus);
        };
    }, [enabled, socket, isConnected, dispatch]);
};

export default useDeploymentStatus;
