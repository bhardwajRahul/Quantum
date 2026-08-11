export interface ServerHealth{
    serverStatus: string;
    cpuStatus: string;
    ramStatus: string;
    cpuPercent: number;
    ramPercent: number;
    memTotal: number;
    memFree: number;
}
