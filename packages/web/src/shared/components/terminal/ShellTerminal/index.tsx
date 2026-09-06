import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button, Spinner } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import { TERMINAL_THEME } from '@/shared/components/terminal/theme';
import type { ReactNode } from 'react';
import type { ChannelApi, ChannelStatus } from '@/shared/contracts/channel';
import type { TerminalExit } from '@quantum/contracts/modules/repository/gateway';

const CONNECTION_LABEL: Partial<Record<ChannelStatus, string>> = {
    connecting: 'Connecting to shell…',
    reconnecting: 'Connection lost — reconnecting…'
};

const exitBanner = (code: number): string => `\r\n\x1b[31mProcess exited with code ${code}\x1b[0m\r\n`;

interface ShellTerminalProps{
    channelPath: string;
    joinPayload?: object;
    title?: string;
    description: string;
    actions?: ReactNode;
}

const ShellTerminal = ({ channelPath, joinPayload = {}, title = 'Shell', description, actions }: ShellTerminalProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const joinedRef = useRef(false);

    const [joined, setJoined] = useState(false);

    const channel = useChannel(channelPath, {
        'terminal.join': () => {
            joinedRef.current = true;
            setJoined(true);
        },
        'terminal.output': (data) => terminalRef.current?.write(data as string),
        'terminal.exit': (data) => {
            const { code } = data as TerminalExit;
            const term = terminalRef.current;
            if(!term) return;
            term.options.disableStdin = true;
            term.write(exitBanner(code));
        }
    });

    const channelRef = useRef<ChannelApi>(channel);
    useEffect(() => {
        channelRef.current = channel;
    });

    const { status, send } = channel;
    const payloadJson = JSON.stringify(joinPayload);

    useEffect(() => {
        if(status !== 'open'){
            joinedRef.current = false;
            setJoined(false);
            return;
        }

        send('terminal.join', JSON.parse(payloadJson) as object);
    }, [status, send, payloadJson]);

    useEffect(() => {
        const term = terminalRef.current;
        if(!joined || !term) return;

        send('terminal.resize', { cols: term.cols, rows: term.rows });
    }, [joined, send]);

    useEffect(() => {
        if(!containerRef.current) return;

        const term = new Terminal({ cursorBlink: true, convertEol: true, theme: TERMINAL_THEME });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();
        terminalRef.current = term;

        const offData = term.onData((data) => {
            if(!joinedRef.current) return;
            channelRef.current.send('terminal.input', data);
        });

        const offResize = term.onResize(({ cols, rows }) => {
            if(!joinedRef.current) return;
            channelRef.current.send('terminal.resize', { cols, rows });
        });

        const observer = new ResizeObserver(() => fitAddon.fit());
        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            offData.dispose();
            offResize.dispose();
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
                    {channel.status !== 'open' && (
                        <span className='label-caps flex items-center gap-2 text-muted'>
                            <Spinner size='sm' color='current' />
                            {CONNECTION_LABEL[channel.status]}
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

            <div className='mt-6 flex min-h-[24rem] flex-1 flex-col border border-border lg:min-h-0'>
                <div ref={containerRef} className='min-h-0 flex-1 overflow-hidden bg-black p-2' />
            </div>
        </div>
    );
};

export default ShellTerminal;
