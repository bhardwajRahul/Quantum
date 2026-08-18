import { useEffect, useRef, useState } from 'react';
import { Cpu, MemoryStick, Globe, Check, Copy } from 'lucide-react';
import { server } from '@services/platform/service';
import { cn } from '@/lib/utils';

const POLL_MS = 15000;

const isOverloaded = (code) => String(code || '').toLowerCase().includes('overloaded');

const Metric = ({ icon: Icon, label, value, critical }) => (
    <span className='inline-flex items-center gap-1.5'>
        <Icon className='h-3.5 w-3.5 text-muted-foreground/70' />
        <span className='text-muted-foreground'>{label}</span>
        <span className={cn('tabular-nums font-medium', critical ? 'text-destructive' : 'text-foreground/80')}>{value}</span>
    </span>
);

const Dot = ({ critical }) => (
    <span className={cn('inline-flex h-2 w-2 rounded-full', critical ? 'bg-destructive' : 'bg-success')} />
);

const StatusBar = () => {
    const [health, setHealth] = useState(null);
    const [ip, setIp] = useState(null);
    const [copied, setCopied] = useState(false);
    const timer = useRef(null);

    useEffect(() => {
        let alive = true;
        const poll = async () => {
            try{
                const res = await server.health({});
                if(alive) setHealth(res?.data || null);
            }catch{ if(alive) setHealth(null); }
        };

        (async () => {
            try{
                const res = await server.ip({});
                if(alive) setIp(typeof res?.data === 'string' ? res.data : (res?.data?.ip || null));
            }catch{   }
        })();
        poll();
        timer.current = setInterval(poll, POLL_MS);
        return () => { alive = false; if(timer.current) clearInterval(timer.current); };
    }, []);

    const copyIp = () => {
        if(!ip) return;
        try{ navigator.clipboard.writeText(ip); setCopied(true); setTimeout(() => setCopied(false), 1200); }catch{   }
    };

    const overloaded = isOverloaded(health?.serverStatus);
    const cpuCritical = isOverloaded(health?.cpuStatus);
    const ramCritical = isOverloaded(health?.ramStatus);
    const hasHealth = !!health;

    return (
        <footer className='fixed inset-x-0 bottom-0 z-30 h-8 border-t border-border bg-background lg:pl-60'>
            <div className='mx-auto flex h-full max-w-7xl items-center gap-3 px-4 text-xs sm:px-6 lg:px-8'>

                <span className='inline-flex items-center gap-1.5'>
                    <Dot critical={overloaded} />
                    <span className='font-medium text-foreground/80'>
                        {hasHealth ? (overloaded ? 'Degraded' : 'Operational') : 'Offline'}
                    </span>
                </span>

                {hasHealth && (
                    <>
                        <span className='h-3.5 w-px bg-border' aria-hidden />
                        <Metric icon={Cpu} label='CPU' value={`${health.cpuPercent ?? '—'}%`} critical={cpuCritical} />
                        <Metric icon={MemoryStick} label='RAM' value={`${health.ramPercent ?? '—'}%`} critical={ramCritical} />
                    </>
                )}

                {ip && (
                    <>
                        <span className='ml-auto h-3.5 w-px bg-border' aria-hidden />
                        <button
                            type='button'
                            onClick={copyIp}
                            className='inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors'
                            aria-label='Copy server IP'
                        >
                            <Globe className='h-3.5 w-3.5' />
                            <span className='font-mono'>{ip}</span>
                            {copied ? <Check className='h-3 w-3 text-success' /> : <Copy className='h-3 w-3 opacity-60' />}
                        </button>
                    </>
                )}
            </div>
        </footer>
    );
};

export default StatusBar;
