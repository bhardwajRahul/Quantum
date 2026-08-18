import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useWindowSize, useDocumentTitle } from '@hooks/common/';
import { useRemoteTerminal } from '@hooks/ws/';
import { PageHeader } from '@components/atoms/kit';
import './Shell.css';

const Shell = () => {
    const termContainerRef = useRef(null);
    const { width } = useWindowSize();
    const { repositoryAlias } = useParams();
    const { isConnected, fitAddonRef } = useRemoteTerminal({
        termContainerRef, query: { repositoryAlias, action: 'Repository::Shell' } });
    useDocumentTitle('Repository Shell');

    useEffect(() => {
        if(!fitAddonRef.current) return;
        fitAddonRef.current.fit();
    }, [width]);

    return (
        <div>
            <PageHeader
                title='Advanced repository management'
                subtitle='Interact with the root of your repository through the command line. A connection with the server will be initiated to manage communication.'
            />

            <div id='Repository-Shell-Body-Container' className='rounded-xl border border-border bg-card p-3 shadow-sm'>
                <div id='Repository-Shell' className='overflow-hidden rounded-lg bg-[#0b0b12]'>
                    {!isConnected && (
                        <aside id='Socket-Connection-Loading-Container'>
                            <div className='flex items-center gap-3 text-slate-200'>
                                <Loader2 className='h-5 w-5 animate-spin text-primary' />
                                <span className='text-sm'>Establishing connection...</span>
                            </div>
                        </aside>
                    )}

                    <div className='Terminal-Container' ref={termContainerRef} />
                </div>
            </div>
        </div>
    );
};

export default Shell;
