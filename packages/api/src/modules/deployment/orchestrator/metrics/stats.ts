export interface NormalizedStats{
    cpuPercent: number;
    memUsage: number;
    memLimit: number;
    memPercent: number;
    netRx: number;
    netTx: number;
    blkRead: number;
    blkWrite: number;
    pids: number;
}

interface CpuUsage{
    total_usage?: number;
    percpu_usage?: number[];
}

interface CpuStats{
    cpu_usage?: CpuUsage;
    system_cpu_usage?: number;
    online_cpus?: number;
}

interface MemoryStats{
    usage?: number;
    limit?: number;
    stats?: { cache?: number; inactive_file?: number };
}

interface NetworkStats{
    rx_bytes?: number;
    tx_bytes?: number;
}

interface BlkioEntry{
    op?: string;
    value?: number;
}

export interface ContainerRawStats{
    cpu_stats?: CpuStats;
    precpu_stats?: CpuStats;
    memory_stats?: MemoryStats;
    networks?: Record<string, NetworkStats>;
    blkio_stats?: { io_service_bytes_recursive?: BlkioEntry[] };
    pids_stats?: { current?: number };
}

const round2 = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export const sampleContainerStats = (raw: ContainerRawStats): NormalizedStats => {
    const cpu = raw.cpu_stats ?? {};
    const precpu = raw.precpu_stats ?? {};

    const cpuDelta = (cpu.cpu_usage?.total_usage ?? 0) - (precpu.cpu_usage?.total_usage ?? 0);
    const systemDelta = (cpu.system_cpu_usage ?? 0) - (precpu.system_cpu_usage ?? 0);
    const numCpus = cpu.online_cpus ?? cpu.cpu_usage?.percpu_usage?.length ?? 1;

    let cpuPercent = 0;
    if(systemDelta > 0 && cpuDelta > 0){
        cpuPercent = (cpuDelta / systemDelta) * numCpus * 100;
    }

    const mem = raw.memory_stats ?? {};
    const cache = mem.stats?.cache ?? mem.stats?.inactive_file ?? 0;
    const memUsage = Math.max(0, (mem.usage ?? 0) - cache);
    const memLimit = mem.limit ?? 0;
    const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

    let netRx = 0;
    let netTx = 0;
    for(const key of Object.keys(raw.networks ?? {})){
        const entry = (raw.networks ?? {})[key];
        netRx += entry?.rx_bytes ?? 0;
        netTx += entry?.tx_bytes ?? 0;
    }

    let blkRead = 0;
    let blkWrite = 0;
    for(const entry of raw.blkio_stats?.io_service_bytes_recursive ?? []){
        const op = String(entry.op ?? '').toLowerCase();
        if(op === 'read') blkRead += entry.value ?? 0;
        else if(op === 'write') blkWrite += entry.value ?? 0;
    }

    return {
        cpuPercent: round2(cpuPercent),
        memUsage,
        memLimit,
        memPercent: round2(memPercent),
        netRx,
        netTx,
        blkRead,
        blkWrite,
        pids: raw.pids_stats?.current ?? 0
    };
};
