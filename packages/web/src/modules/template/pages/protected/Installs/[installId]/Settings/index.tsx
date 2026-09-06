import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Switch } from '@heroui/react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import SettingsSection from '@/shared/components/SettingsSection';
import SettingsRow from '@/shared/components/SettingsRow';
import InlineError from '@/shared/components/InlineError';
import ErrorState from '@/shared/components/ErrorState';
import CenterState from '@/shared/components/CenterState';
import { FieldsSkeleton } from '@/shared/components/skeletons';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { templateInstallApi } from '@/modules/template/api/api';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import { copyText } from '@/shared/utils/clipboard';

const copy = errorCopy(templateErrorMessages);

const COPIED_MS = 2000;

interface WebhookProps{
    url: string | null;
    isRotating: boolean;
    onRotate: () => void;
}

const Webhook = ({ url, isRotating, onRotate }: WebhookProps) => {
    const [copied, setCopied] = useState(false);

    if(url === null){
        return (
            <Button variant='secondary' isPending={isRotating} onPress={onRotate}>
                Create webhook URL
            </Button>
        );
    }

    const copyUrl = async () => {
        await copyText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_MS);
    };

    return (
        <div className='flex flex-col gap-3'>
            <code className='block truncate border border-border px-3 py-2.5 font-mono text-[0.8125rem] text-foreground'>{url}</code>
            <div className='flex flex-wrap gap-2'>
                <Button size='sm' variant='secondary' onPress={() => { void copyUrl(); }}>
                    {copied ? <Check aria-hidden='true' className='size-3.5' /> : <Copy aria-hidden='true' className='size-3.5' />}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button size='sm' variant='secondary' isPending={isRotating} onPress={onRotate}>
                    <RefreshCw aria-hidden='true' className='size-3.5' />
                    Rotate
                </Button>
            </div>
        </div>
    );
};

const InstallSettings = () => {
    const { installId } = useParams<{ installId: string }>();
    const id = installId !== undefined ? Number(installId) : undefined;
    const triggers = useQuery((templateInstallId: number) => templateInstallApi.triggers({ path: { id: templateInstallId } }), [id]);
    const update = useMutation(
        (templateInstallId: number, watchImages: boolean) =>
            templateInstallApi.updateTriggers({ path: { id: templateInstallId }, body: { watchImages } }),
        { onSuccess: () => triggers.reload() }
    );
    const rotate = useMutation(
        (templateInstallId: number) => templateInstallApi.rotateDeployToken({ path: { id: templateInstallId } }),
        { onSuccess: () => triggers.reload() }
    );

    if(id === undefined || triggers.loading) return <FieldsSkeleton rows={2} />;

    if(triggers.error !== undefined || triggers.data === null){
        return (
            <CenterState className='h-full'>
                <ErrorState
                    title='Could not load the deploy triggers'
                    description={copy(triggers.error ?? 'TemplateInstall::NotFound')}
                    onRetry={triggers.reload}
                />
            </CenterState>
        );
    }

    const error = update.error ?? rotate.error;

    return (
        <div className='flex flex-col gap-10 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0'>
            <SettingsSection title='Deploy triggers' description='Redeploy this stack without pressing the button.'>
                <SettingsRow
                    title='Webhook'
                    description='POST to this URL and the stack redeploys, pulling every image again. Call it from your CI once the new images are published. Anyone holding the URL can trigger a deploy; rotate it if it leaks.'
                >
                    <Webhook
                        url={triggers.data.webhookUrl}
                        isRotating={rotate.loading}
                        onRotate={() => { void rotate.run(id).catch(() => undefined); }}
                    />
                </SettingsRow>

                <SettingsRow
                    title='Watch image tags'
                    description='Every five minutes Quantum pulls the image of each service and redeploys the stack when a tag points at a new image.'
                    action={(
                        <Switch
                            aria-label='Watch image tags'
                            isSelected={triggers.data.watchImages}
                            isDisabled={update.loading}
                            onChange={(watchImages) => { void update.run(id, watchImages).catch(() => undefined); }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                />
            </SettingsSection>

            {error !== undefined && <InlineError>{copy(error)}</InlineError>}
        </div>
    );
};

export default InstallSettings;
