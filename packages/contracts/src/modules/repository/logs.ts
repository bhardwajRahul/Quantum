export interface RuntimeLogsSubscribed{
    repositoryId: number;
}

export interface RuntimeLogLine{
    line: string;
}

export type RuntimeLogServerFrames = {
    'logs.subscribe': RuntimeLogsSubscribed;
    'logs.line': RuntimeLogLine;
};
