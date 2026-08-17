import type SocketChannel from '@/shared/services/socket/SocketChannel';
import type { ActivityServerFrames } from '@quantum/contracts/modules/activity/gateway';
import type { DeploymentStatusFrame, DeploymentLogFrame } from '@quantum/contracts/modules/deployment/domain';
import type { TerminalServerFrames } from '@quantum/contracts/modules/repository/gateway';

export type ChannelStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface OutboundFrame{
    type?: string;
    data?: unknown;
    error?: string;
}

export type MessageHandler<T> = (data: T) => void;

export interface ChannelHandlers{
    [type: string]: MessageHandler<unknown>;
}

export interface ChannelMap{
    '/activity/stream': ActivityServerFrames;
    '/deployment/stream': {
        'deployment.statusChanged': DeploymentStatusFrame;
        'deployment.completed': DeploymentStatusFrame;
        'deployment.log': DeploymentLogFrame;
    };
    '/repository/:repositoryId/terminal': TerminalServerFrames;
}

export type HandlersFor<P extends string> = P extends keyof ChannelMap
    ? { [K in keyof ChannelMap[P]]?: MessageHandler<ChannelMap[P][K]> }
    : ChannelHandlers;

export interface ChannelApi{
    send: (type: string, data?: unknown) => boolean;
    status: ChannelStatus;
    lastError: string | undefined;
    clearError: () => void;
}

export type StatusHandler = (status: ChannelStatus) => void;

export type ErrorHandler = (message: string) => void;

export interface PoolEntry{
    channel: SocketChannel;
    refs: number;
}
