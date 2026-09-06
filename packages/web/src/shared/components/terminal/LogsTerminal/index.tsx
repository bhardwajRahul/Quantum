import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button, Spinner } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import { TERMINAL_THEME } from '@/shared/components/terminal/theme';
import type { ReactNode } from 'react';
import type { ChannelStatus } from '@/shared/contracts/channel';

const SCROLLBACK = 5_000;

const CONNECTION_LABEL: Partial<Record<ChannelStatus, string>> = {
    connecting: 'Attaching…',
    reconnecting: 'Connection lost — reattaching…'
};

interface LogsTerminalProps{
    channelPath: string;
    subscribePayload?: object;
    title?: string;
    description: string;
    actions?: ReactNode;
}

const LogsTerminal = ({ channelPath, subscribePayload = {}, title = 'Logs', description, actions }: LogsTerminalProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<Terminal | null>(null);

    const channel = useChannel(channelPath, {
        'logs.line': (data) => {
            const { line } = data as { line: string };
            terminalRef.current?.writeln(line);
        }
    });

    const { status, send } = channel;
    const payloadJson = JSON.stringify(subscribePayload);

    useEffect(() => {
        if(status !== 'open') return;
        terminalRef.current?.clear();
        send('logs.subscribe', JSON.parse(payloadJson) as object);
    }, [status, send, payloadJson]);

    useEffect(() => {
        if(!containerRef.current) return;

        const term = new Terminal({
            convertEol: true,
            disableStdin: true,
            cursorBlink: false,
            cursorStyle: 'bar',
            scrollback: SCROLLBACK,
            theme: TERMINAL_THEME
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

    return (
        <div className='flex min-h-0 flex-1 flex-col'>
            <div className='flex flex-wrap items-end justify-between gap-4'>
                <div>
                    <h2 className='text-[0.9375rem] font-medium text-foreground'>{title}</h2>
                    <p className='mt-1 text-[0.8125rem] text-muted'>{description}</p>
                </div>

                <div className='flex flex-wrap items-center gap-4'>
                    {status !== 'open' && (
                        <span className='label-caps flex items-center gap-2 text-muted'>
                            <Spinner size='sm' color='current' />
                            {CONNECTION_LABEL[status]}
                        </span>
                    )}

                    {actions}
                </div>
            </div>

            {channel.lastError && (
                <div className='mt-4 flex items-center justify-between gap-3 border-b border-separator pb-3 text-[0.8125rem] text-danger'>
                    <span className='flex items-center gap-2'>
                        <TriangleAlert className='size-4 shrink-0' aria-hidden='true' />
                        {channel.lastError}
                    </span>
                    <Button size='sm' variant='secondary' onPress={channel.clearError}>Dismiss</Button>
                </div>
            )}

            {}
            <div className='mt-6 flex min-h-[24rem] flex-1 flex-col border border-border lg:min-h-0'>
                <div ref={containerRef} className='min-h-0 flex-1 overflow-hidden bg-black p-2' />
            </div>
        </div>
    );
};

export default LogsTerminal;
