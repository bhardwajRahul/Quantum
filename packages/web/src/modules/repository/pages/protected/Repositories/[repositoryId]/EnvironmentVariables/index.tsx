import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Input, TextField } from '@heroui/react';
import { ArrowRight, KeyRound, Plus, Rocket, Trash2 } from 'lucide-react';
import ErrorState from '@/shared/components/ErrorState';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import InlineError from '@/shared/components/InlineError';
import { useQuery } from '@/shared/hooks/api/use-query';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { deploymentApi } from '@/modules/repository/api/deployment-api';
import {
    addEnvVarRow,
    envVarRowsFrom,
    envVarRowsToMap,
    removeEnvVarRow,
    updateEnvVarRow
} from '@/modules/repository/utils/env-vars';
import { isNotFound } from '@/shared/utils/errors';
import { deploymentErrorMessages } from '@/modules/repository/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { EnvVarRow } from '@/modules/repository/utils/env-vars';
import type { UpdateDeploymentInput } from '@quantum/contracts/modules/deployment/http';

const copy = errorCopy(deploymentErrorMessages);

const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-3';

interface EnvironmentVariablesHeaderProps{
    isSaving: boolean;
    onAdd: () => void;
    onSave: () => void;
}

const EnvironmentVariablesHeader = ({ isSaving, onAdd, onSave }: EnvironmentVariablesHeaderProps) => (
    <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
            <h2 className='text-[0.9375rem] font-medium text-foreground'>Environment Variables</h2>
            <p className='mt-1 max-w-[58ch] text-[0.8125rem] text-muted'>
                Available to your app at build and run time. A .env file at the repository root is loaded
                automatically on deploy.
            </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
            <Button variant='secondary' isDisabled={isSaving} onPress={onAdd}>
                <Plus aria-hidden='true' className='size-4' />
                Add variable
            </Button>
            <Button isPending={isSaving} isDisabled={isSaving} onPress={onSave}>
                Save changes
                <ArrowRight aria-hidden='true' className='size-4' />
            </Button>
        </div>
    </div>
);

interface EnvironmentVariableRowProps{
    row: EnvVarRow;
    onChange: (key: string, value: string) => void;
    onRemove: () => void;
}

const EnvironmentVariableRow = ({ row, onChange, onRemove }: EnvironmentVariableRowProps) => (
    <div className={ROW_GRID}>
        <TextField
            aria-label='Key'
            value={row.key}
            onChange={(key) => onChange(key, row.value)}
            validationBehavior='aria'
            fullWidth
        >
            <Input className='font-mono' placeholder='e.g. DATABASE_URL' autoComplete='off' />
        </TextField>

        <TextField
            aria-label='Value'
            value={row.value}
            onChange={(value) => onChange(row.key, value)}
            validationBehavior='aria'
            fullWidth
        >
            <Input className='font-mono' placeholder='Value' autoComplete='off' />
        </TextField>

        <Button
            isIconOnly
            variant='ghost'
            className='text-muted hover:text-foreground'
            aria-label={row.key === '' ? 'Remove variable' : `Remove ${row.key}`}
            onPress={onRemove}
        >
            <Trash2 aria-hidden='true' className='size-4' />
        </Button>
    </div>
);

interface EnvironmentVariablesEditorProps{
    deploymentId: number;
    environmentVariables: Record<string, string>;
    onSaved: () => void;
}

const EnvironmentVariablesEditor = ({ deploymentId, environmentVariables, onSaved }: EnvironmentVariablesEditorProps) => {
    const [rows, setRows] = useState<EnvVarRow[]>(() => envVarRowsFrom(environmentVariables));
    const update = useMutation((body: UpdateDeploymentInput) => deploymentApi.update({ path: { id: deploymentId }, body }));

    const handleSave = async () => {
        const saved = await update
            .run({ environmentVariables: envVarRowsToMap(rows) })
            .then(() => true, () => false);

        if(saved) onSaved();
    };

    return (
        <div className='flex min-h-0 flex-1 flex-col'>
            <EnvironmentVariablesHeader
                isSaving={update.loading}
                onAdd={() => setRows((current) => addEnvVarRow(current))}
                onSave={() => { void handleSave(); }}
            />

            <div className='mt-6 flex flex-1 flex-col gap-3'>
                {rows.length === 0 ? (
                    <CenterState>
                        <EmptyState
                            icon={KeyRound}
                            title='No environment variables'
                            description='Add a variable to make it available to your app at build and run time.'
                        >
                            <Button onPress={() => setRows((current) => addEnvVarRow(current))}>
                                <Plus aria-hidden='true' className='size-4' />
                                Add variable
                            </Button>
                        </EmptyState>
                    </CenterState>
                ) : (
                    <>
                        <div className={`${ROW_GRID} border-b border-border pb-2`}>
                            <span className='label-caps text-muted'>Key</span>
                            <span className='label-caps text-muted'>Value</span>
                            <span className='sr-only'>Actions</span>
                        </div>

                        {rows.map((row, index) => (
                            <EnvironmentVariableRow
                                key={index}
                                row={row}
                                onChange={(key, value) => setRows((current) => updateEnvVarRow(current, index, key, value))}
                                onRemove={() => setRows((current) => removeEnvVarRow(current, index))}
                            />
                        ))}
                    </>
                )}

                {update.error !== undefined && <InlineError>{copy(update.error)}</InlineError>}
            </div>
        </div>
    );
};

const NoDeploymentYet = () => (
    <CenterState className='h-full'>
        <EmptyState
            icon={Rocket}
            title='No deployment yet'
            description='Environment variables become available after your first deploy.'
        />
    </CenterState>
);

const EnvironmentVariables = () => {
    const { repositoryId } = useParams<{ repositoryId: string }>();
    const id = repositoryId !== undefined ? Number(repositoryId) : undefined;
    const environment = useQuery((repositoryId: number) => deploymentApi.environment({ path: { repositoryId } }), [id]);

    if(id === undefined || environment.loading){
        return <CenterState className='h-full'><EmptyState title='Loading environment variables' loading compact /></CenterState>;
    }

    if(environment.error !== undefined){
        if(isNotFound(environment.error)) return <NoDeploymentYet />;

        return (
            <CenterState className='h-full'>
                <ErrorState
                    title='Could not load environment variables'
                    description={copy(environment.error)}
                    onRetry={environment.reload}
                />
            </CenterState>
        );
    }

    const data = environment.data;
    if(data === null) return <NoDeploymentYet />;

    return (
        <EnvironmentVariablesEditor
            key={data.deploymentId}
            deploymentId={data.deploymentId}
            environmentVariables={data.environmentVariables}
            onSaved={environment.reload}
        />
    );
};

export default EnvironmentVariables;
