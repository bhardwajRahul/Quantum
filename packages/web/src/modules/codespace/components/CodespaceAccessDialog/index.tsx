import { useState } from 'react';
import { LinesSkeleton } from '@/shared/components/skeletons';
import { Button } from '@heroui/react';
import { ArrowUpRight, Check, Copy, Square } from 'lucide-react';
import Modal from '@/shared/components/Modal';
import InlineError from '@/shared/components/InlineError';
import { useQuery } from '@/shared/hooks/api/use-query';
import { codespaceApi } from '@/modules/codespace/api/api';
import { codespaceErrorMessages } from '@/modules/codespace/utils/error-messages';
import { copyText } from '@/shared/utils/clipboard';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Codespace } from '@quantum/contracts/modules/codespace/domain';

const copy = errorCopy(codespaceErrorMessages);

interface CopyFieldProps{
    label: string;
    value: string;
}

const CopyField = ({ label, value }: CopyFieldProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        copyText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className='flex flex-col gap-1.5'>
            <span className='text-[0.8125rem] text-muted'>{label}</span>

            <div className='flex items-center gap-2'>
                <code className='min-w-0 flex-1 truncate rounded-md bg-surface px-3 py-2 text-[0.8125rem] text-foreground'>
                    {value}
                </code>

                <Button variant='secondary' onPress={handleCopy}>
                    {copied ? <Check aria-hidden='true' className='size-4' /> : <Copy aria-hidden='true' className='size-4' />}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
        </div>
    );
};

interface CodespaceAccessDialogProps{
    codespace: Codespace | null;
    onClose: () => void;
    onStop?: () => void;
    isStopping?: boolean;
}

const CodespaceAccessDialog = ({ codespace, onClose, onStop, isStopping = false }: CodespaceAccessDialogProps) => {
    const access = useQuery((codespaceId: number) => codespaceApi.access({ path: { id: codespaceId } }), [codespace?.id], { enabled: codespace !== null });

    return (
        <Modal
            isOpen={codespace !== null}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title={codespace === null ? 'Access' : `Access · ${codespace.name}`}
        >
            <div className='flex flex-col gap-4'>
                {access.loading && <LinesSkeleton lines={2} />}

                {!access.loading && access.error !== undefined && (
                    <div className='flex flex-col gap-2'>
                        <InlineError>{copy(access.error)}</InlineError>
                        <Button variant='secondary' onPress={access.reload}>Try again</Button>
                    </div>
                )}

                {!access.loading && access.error === undefined && access.data !== null && (
                    <>
                        <CopyField label='URL' value={access.data.accessUrl} />
                        <CopyField label='Password' value={access.data.password} />
                    </>
                )}

                <div className='flex flex-wrap justify-end gap-2'>
                    {onStop !== undefined && (
                        <Button variant='secondary' isPending={isStopping} onPress={onStop}>
                            <Square aria-hidden='true' className='size-4' />
                            Stop workspace
                        </Button>
                    )}
                    <Button variant='secondary' onPress={onClose}>Close</Button>
                    {access.data !== null && (
                        <a
                            href={access.data.accessUrl}
                            target='_blank'
                            rel='noreferrer'
                            className='inline-flex items-center gap-1.5 bg-foreground px-4 py-2 text-[0.8125rem] font-medium text-background transition-opacity hover:opacity-90 motion-reduce:transition-none'
                        >
                            Open VS Code
                            <ArrowUpRight aria-hidden='true' className='size-4' />
                        </a>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default CodespaceAccessDialog;
