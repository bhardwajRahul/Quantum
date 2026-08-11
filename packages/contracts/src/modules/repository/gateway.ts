export interface TerminalResizePayload{
    cols: number;
    rows: number;
}

export interface TerminalJoined{
    repositoryId: number;
}

export interface TerminalExit{
    code: number;
}

export interface TerminalJoinFrame{
    type: 'terminal.join';
    data: Record<string, never>;
}

export interface TerminalInputFrame{
    type: 'terminal.input';
    data: string;
}

export interface TerminalResizeFrame{
    type: 'terminal.resize';
    data: TerminalResizePayload;
}

export interface TerminalJoinedFrame{
    type: 'terminal.join';
    data: TerminalJoined;
}

export interface TerminalOutputFrame{
    type: 'terminal.output';
    data: string;
}

export interface TerminalExitFrame{
    type: 'terminal.exit';
    data: TerminalExit;
}

export type TerminalClientFrame = TerminalJoinFrame | TerminalInputFrame | TerminalResizeFrame;

export type TerminalServerFrame = TerminalJoinedFrame | TerminalOutputFrame | TerminalExitFrame;

export type TerminalClientFrames = {
    [T in TerminalClientFrame['type']]: Extract<TerminalClientFrame, { type: T }>['data'];
};

export type TerminalServerFrames = {
    [T in TerminalServerFrame['type']]: Extract<TerminalServerFrame, { type: T }>['data'];
};
