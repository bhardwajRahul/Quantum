import os from 'node:os';
import type { ServerHealth } from '@quantum/contracts/modules/server/domain';

const SAMPLE_MS = 100;
const OVERLOAD_THRESHOLD = 80;

interface CpuSnapshot{
    idle: number;
    total: number;
}

export default class HealthService{
    async snapshot(): Promise<ServerHealth>{
        const start = this.#cpuSnapshot();
        await new Promise((resolve) => setTimeout(resolve, SAMPLE_MS));
        const end = this.#cpuSnapshot();

        const idleDifference = end.idle - start.idle;
        const totalDifference = end.total - start.total;
        const cpuPercent = totalDifference > 0 ? 100 - Math.floor((100 * idleDifference) / totalDifference) : 0;
        const ramUsage = (1 - os.freemem() / os.totalmem()) * 100;

        return {
            serverStatus: cpuPercent > OVERLOAD_THRESHOLD || ramUsage > OVERLOAD_THRESHOLD
                ? 'Server::Health::Overloaded'
                : 'Server::Health::Healthy',
            cpuStatus: cpuPercent > OVERLOAD_THRESHOLD
                ? 'Server::Health::CPU::Overloaded'
                : 'Server::Health::CPU::Healthy',
            ramStatus: ramUsage > OVERLOAD_THRESHOLD
                ? 'Server::Health::RAM::Overloaded'
                : 'Server::Health::RAM::Healthy',
            cpuPercent: Math.max(0, Math.min(100, cpuPercent)),
            ramPercent: Math.round(Math.max(0, Math.min(100, ramUsage))),
            memTotal: os.totalmem(),
            memFree: os.freemem()
        };
    }

    #cpuSnapshot(): CpuSnapshot{
        let totalIdle = 0;
        let totalTick = 0;
        const cpus = os.cpus();
        for(const cpu of cpus){
            for(const ticks of Object.values(cpu.times)){
                totalTick += ticks;
            }
            totalIdle += cpu.times.idle;
        }
        return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
    }
}
