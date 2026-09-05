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

export type TerminalServerFrames = {
    'terminal.join': TerminalJoined;
    'terminal.output': string;
    'terminal.exit': TerminalExit;
};
