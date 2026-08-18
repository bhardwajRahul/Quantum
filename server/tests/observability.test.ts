import { describe, it, expect } from 'vitest';
import { sampleContainerStats } from '@services/metrics/stats';
import { evaluateHealthTransition } from '@services/health/probe';

describe('sampleContainerStats (metrics normalization)', () => {

    const payload = {
        cpu_stats: {
            cpu_usage: { total_usage: 6_000_000_000 },
            system_cpu_usage: 20_000_000_000,
            online_cpus: 4
        },
        precpu_stats: {
            cpu_usage: { total_usage: 4_000_000_000 },
            system_cpu_usage: 10_000_000_000
        },
        memory_stats: {
            usage: 200 * 1024 * 1024,
            stats: { cache: 50 * 1024 * 1024 },
            limit: 500 * 1024 * 1024
        },
        networks: {
            eth0: { rx_bytes: 1000, tx_bytes: 2000 },
            eth1: { rx_bytes: 500, tx_bytes: 250 }
        },
        blkio_stats: {
            io_service_bytes_recursive: [
                { op: 'Read', value: 4096 },
                { op: 'Write', value: 8192 },
                { op: 'Read', value: 1024 }
            ]
        },
        pids_stats: { current: 7 }
    };

    it('computes cpuPercent from cpu vs precpu deltas scaled by online_cpus', () => {
        const stats = sampleContainerStats(payload);
        expect(stats.cpuPercent).toBe(80);
    });

    it('subtracts page cache from memUsage and computes memPercent', () => {
        const stats = sampleContainerStats(payload);
        expect(stats.memUsage).toBe(150 * 1024 * 1024);
        expect(stats.memLimit).toBe(500 * 1024 * 1024);
        expect(stats.memPercent).toBe(30);
    });

    it('sums network and block IO across interfaces/devices', () => {
        const stats = sampleContainerStats(payload);
        expect(stats.netRx).toBe(1500);
        expect(stats.netTx).toBe(2250);
        expect(stats.blkRead).toBe(5120);
        expect(stats.blkWrite).toBe(8192);
        expect(stats.pids).toBe(7);
    });

    it('is robust to a missing/empty payload (no NaN, no throw)', () => {
        const stats = sampleContainerStats({});
        expect(stats.cpuPercent).toBe(0);
        expect(stats.memPercent).toBe(0);
        expect(stats.memUsage).toBe(0);
        expect(stats.pids).toBe(0);
    });

    it('does not divide by zero when the first sample has no precpu baseline', () => {
        const first = sampleContainerStats({
            cpu_stats: { cpu_usage: { total_usage: 5_000_000_000 }, system_cpu_usage: 0, online_cpus: 2 },
            precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 }
        });
        expect(first.cpuPercent).toBe(0);
    });
});

describe('evaluateHealthTransition (threshold hysteresis)', () => {
    const start = { status: 'unknown' as const, consecutiveFailures: 0, consecutiveSuccesses: 0 };

    it('does not flip to unhealthy before the failure threshold', () => {
        let state: any = { ...start };

        let r = evaluateHealthTransition(state, false, 2, 3);
        expect(r.status).toBe('unknown');
        expect(r.transitioned).toBe(false);
        r = evaluateHealthTransition(r, false, 2, 3);
        expect(r.status).toBe('unknown');
        expect(r.transitioned).toBe(false);

        r = evaluateHealthTransition(r, false, 2, 3);
        expect(r.status).toBe('unhealthy');
        expect(r.transitioned).toBe(true);
        expect(r.consecutiveFailures).toBe(3);
    });

    it('recovers to healthy only after healthyThreshold consecutive successes', () => {
        let r: any = { status: 'unhealthy', consecutiveFailures: 5, consecutiveSuccesses: 0 };
        r = evaluateHealthTransition(r, true, 2, 3);
        expect(r.status).toBe('unhealthy');
        expect(r.consecutiveFailures).toBe(0);
        r = evaluateHealthTransition(r, true, 2, 3);
        expect(r.status).toBe('healthy');
        expect(r.transitioned).toBe(true);
    });

    it('a single success resets the failure streak (no flip on flap)', () => {
        let r: any = { status: 'healthy', consecutiveFailures: 2, consecutiveSuccesses: 0 };
        r = evaluateHealthTransition(r, true, 2, 3);
        expect(r.consecutiveFailures).toBe(0);
        expect(r.status).toBe('healthy');
        expect(r.transitioned).toBe(false);
    });
});
