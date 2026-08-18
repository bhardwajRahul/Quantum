import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button, Spinner } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import PageBody from '@/shared/components/layout/PageBody';
import { useChannel } from '@/shared/hooks/socket/use-channel';
import type { ChannelApi, ChannelStatus } from '@/shared/contracts/channel';
import type { TerminalExit } from '@quantum/contracts/modules/repository/gateway';

const CONNECTION_LABEL: Partial<Record<ChannelStatus, string>> = {
    connecting: 'Connecting to shell…',
    reconnecting: 'Connection lost — reconnecting…'
};

const exitBanner = (code: number): string => `\r\n\x1b[31mProcess exited with code ${code}\x1b[0m\r\n`;

const Shell = () => {
    const { repositoryId } = useParams<{ repositoryId: string }>();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const joinedRef = useRef(false);

    const channel = useChannel(`/repository/${repositoryId ?? ''}/terminal`, {
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

    useEffect(() => {
        if(channel.status !== 'open'){
            joinedRef.current = false;
            return;
        }

        channel.send('terminal.join', {});
        joinedRef.current = true;

        const term = terminalRef.current;
        if(term) channel.send('terminal.resize', { cols: term.cols, rows: term.rows });
    }, [channel.status, channel.send]);

    useEffect(() => {
        if(!containerRef.current) return;

        const term = new Terminal({ cursorBlink: true, convertEol: true });
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

    if(!repositoryId) return null;

    return (
        <PageBody width='wide'>
            <div>
                <h1 className='text-lg font-medium text-foreground'>Shell</h1>
                <p className='mt-1.5 text-sm text-muted'>
                    Interactive terminal session for repository #{repositoryId}.
                </p>
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

            {channel.status !== 'open' && (
                <div className='mt-4 flex items-center gap-2 text-[0.8125rem] text-muted'>
                    <Spinner size='sm' color='current' />
                    {CONNECTION_LABEL[channel.status]}
                </div>
            )}

            <div className='mt-4 rounded-xl border border-border p-3'>
                <div ref={containerRef} className='h-[70vh] overflow-hidden rounded-lg bg-[#0b0b12] p-2' />
            </div>
        </PageBody>
    );
};

export default Shell;
