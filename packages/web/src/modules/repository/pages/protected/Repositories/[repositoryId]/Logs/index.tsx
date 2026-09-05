import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button, Spinner } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import PageBody from '@/shared/components/layout/PageBody';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import type { ChannelStatus } from '@/shared/contracts/channel';

const SCROLLBACK = 5_000;

const CONNECTION_LABEL: Partial<Record<ChannelStatus, string>> = {
    connecting: 'Attaching to the deployment…',
    reconnecting: 'Connection lost — reattaching…'
};

const Logs = () => {
    const { repositoryId } = useParams<{ repositoryId: string }>();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const [received, setReceived] = useState(0);

    /*
     * Rendered by a terminal rather than as text, because that is what the bytes are.
     * The output carries more than colour: vite rewrites its own progress lines with
     * cursor control (`\x1b[1G`, `\x1b[0K`), which printed as text turns into the `[1G`
     * and `[0K` litter that made this page unreadable. Stripping the escapes would take
     * the colour with it and still leave the rewritten lines duplicated.
     */
    const channel = useChannel(`/repository/${repositoryId ?? ''}/logs`, {
        'logs.line': (data) => {
            const { line } = data as { line: string };
            terminalRef.current?.writeln(line);
            setReceived((previous) => previous + 1);
        }
    });

    const { status, send } = channel;

    useEffect(() => {
        if(status !== 'open') return;
        send('logs.subscribe', {});
    }, [status, send]);

    useEffect(() => {
        if(!containerRef.current) return;

        const term = new Terminal({
            convertEol: true,
            disableStdin: true,
            cursorBlink: false,
            cursorStyle: 'bar',
            scrollback: SCROLLBACK,
            theme: { background: '#0b0b12' }
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();
        terminalRef.current = term;

        const observer = new ResizeObserver(() => fitAddon.fit());
        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            term.dispose();
            terminalRef.current = null;
        };
    }, []);

    if(!repositoryId) return null;

    return (
        <PageBody width='wide' height='full'>
            <div className='flex items-start justify-between gap-4'>
                <div>
                    <h1 className='text-lg font-medium text-foreground'>Logs</h1>
                    <p className='mt-1.5 text-sm text-muted'>
                        Output from the process serving this deployment.
                    </p>
                </div>

                <Button
                    size='sm'
                    variant='secondary'
                    className='shrink-0'
                    onPress={() => terminalRef.current?.clear()}
                >
                    Clear
                </Button>
            </div>

            {channel.lastError && (
                <div className='mt-4 flex items-center justify-between gap-3 rounded-lg bg-danger/10 px-3.5 py-2.5 text-[0.8125rem] text-danger'>
                    <span className='flex items-center gap-2'>
                        <TriangleAlert className='size-4 shrink-0' aria-hidden='true' />
                        {channel.lastError}
                    </span>
                    <Button size='sm' variant='secondary' onPress={channel.clearError}>Dismiss</Button>
                </div>
            )}

            {status !== 'open' && (
                <div className='mt-4 flex items-center gap-2 text-[0.8125rem] text-muted'>
                    <Spinner size='sm' color='current' />
                    {CONNECTION_LABEL[status]}
                </div>
            )}

            {status === 'open' && received === 0 && (
                <p className='mt-4 text-[0.8125rem] text-muted'>
                    Nothing printed yet. Output appears here as the process writes it.
                </p>
            )}

            <div className='mt-4 rounded-xl border border-border p-3'>
                <div ref={containerRef} className='h-[70vh] overflow-hidden rounded-lg bg-[#0b0b12] p-2' />
            </div>
        </PageBody>
    );
};

export default Logs;
