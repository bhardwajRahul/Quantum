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

const round2 = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export const sampleContainerStats = (raw: any): NormalizedStats => {
    const cpu = raw?.cpu_stats || {};
    const precpu = raw?.precpu_stats || {};

    const cpuDelta = (cpu?.cpu_usage?.total_usage || 0) - (precpu?.cpu_usage?.total_usage || 0);
    const systemDelta = (cpu?.system_cpu_usage || 0) - (precpu?.system_cpu_usage || 0);

    const numCpus = cpu?.online_cpus || cpu?.cpu_usage?.percpu_usage?.length || 1;

    let cpuPercent = 0;
    if(systemDelta > 0 && cpuDelta > 0){
        cpuPercent = (cpuDelta / systemDelta) * numCpus * 100;
    }

    const mem = raw?.memory_stats || {};

    const cache = mem?.stats?.cache ?? mem?.stats?.inactive_file ?? 0;
    const memUsage = Math.max(0, (mem?.usage || 0) - cache);
    const memLimit = mem?.limit || 0;
    const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

    let netRx = 0;
    let netTx = 0;
    const networks = raw?.networks || {};
    for(const key of Object.keys(networks)){
        netRx += networks[key]?.rx_bytes || 0;
        netTx += networks[key]?.tx_bytes || 0;
    }

    let blkRead = 0;
    let blkWrite = 0;
    const blkEntries = raw?.blkio_stats?.io_service_bytes_recursive || [];
    for(const entry of blkEntries){
        const op = String(entry?.op || '').toLowerCase();
        if(op === 'read') blkRead += entry?.value || 0;
        else if(op === 'write') blkWrite += entry?.value || 0;
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
        pids: raw?.pids_stats?.current || 0
    };
};

export default sampleContainerStats;
