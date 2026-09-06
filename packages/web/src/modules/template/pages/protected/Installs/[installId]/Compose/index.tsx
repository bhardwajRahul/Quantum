import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { FileCode2 } from 'lucide-react';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import InlineError from '@/shared/components/InlineError';
import MonacoEditor from '@/shared/components/MonacoEditor';
import SaveStatus from '@/shared/components/forms/SaveStatus';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { useAutosave } from '@/shared/hooks/forms/use-autosave';
import { templateInstallApi } from '@/modules/template/api/api';
import { composeErrorMessage } from '@/modules/template/utils/compose-error';
import type { TemplateInstall } from '@quantum/contracts/modules/template/domain';

const AUTOSAVE_DELAY_MS = 1200;

interface ComposeEditorProps{
    installId: number;
    compose: string;
}

const ComposeEditor = ({ installId, compose: initial }: ComposeEditorProps) => {
    const [compose, setCompose] = useState(initial);
    const update = useMutation((text: string) => templateInstallApi.updateCompose({ path: { id: installId }, body: { compose: text } }));
    const saver = useAutosave<string>({
        value: compose,
        delayMs: AUTOSAVE_DELAY_MS,
        canSave: (text) => text.trim() !== '',
        save: async (text) => {
            await update.run(text);
        }
    });
    const error = update.error;

    return (
        <div className='flex min-h-0 flex-1 flex-col gap-6'>
            <div className='flex flex-wrap items-end justify-between gap-4'>
                <div>
                    <h2 className='text-[0.9375rem] font-medium text-foreground'>Compose file</h2>
                    <p className='mt-1 max-w-[58ch] text-[0.8125rem] text-muted'>
                        Saved automatically once it parses. Redeploy to recreate the services from it. Variables set in
                        the Environment tab take precedence over the ones written here.
                    </p>
                </div>

                <SaveStatus state={saver.state} />
            </div>

            <MonacoEditor value={compose} language='yaml' ariaLabel='Compose file' height='32rem' onChange={setCompose} />

            {error !== undefined && <InlineError>{composeErrorMessage(error)}</InlineError>}
        </div>
    );
};

const InstallCompose = () => {
    const { installId } = useParams<{ installId: string }>();
    const id = installId !== undefined ? Number(installId) : undefined;
    const install = useOutletContext<TemplateInstall>();

    if(id === undefined) return null;

    if(install.compose === null){
        return (
            <CenterState className='h-full'>
                <EmptyState
                    icon={FileCode2}
                    title='Not a compose stack'
                    description='This installation was created from a template, so there is no compose file to edit.'
                />
            </CenterState>
        );
    }

    return <ComposeEditor key={id} installId={id} compose={install.compose} />;
};

export default InstallCompose;
