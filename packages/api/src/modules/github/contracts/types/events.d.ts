import type { GithubConnectedPayload, GithubDisconnectedPayload } from '../domain/events';

declare global{
    interface EventMap{
        'github.connected': GithubConnectedPayload;
        'github.disconnected': GithubDisconnectedPayload;
    }
}
