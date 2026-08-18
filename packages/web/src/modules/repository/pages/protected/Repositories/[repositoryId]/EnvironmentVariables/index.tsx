import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Input, Label, TextField } from '@heroui/react';
import { KeyRound, Plus, Rocket, Save, Trash2 } from 'lucide-react';
import PageBody from '@/shared/components/layout/PageBody';
import LoadingState from '@/shared/components/LoadingState';
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

interface EnvironmentVariablesHeaderProps{
    isSaving: boolean;
    onAdd: () => void;
    onSave: () => void;
}

const EnvironmentVariablesHeader = ({ isSaving, onAdd, onSave }: EnvironmentVariablesHeaderProps) => (
    <div className='flex items-center justify-between gap-4'>
        <div>
            <h1 className='text-lg font-medium text-foreground'>Environment Variables</h1>
            <p className='mt-1.5 text-sm text-muted'>
                Available to your app at build and run time. A .env file at the repository root is loaded
                automatically on deploy.
            </p>
        </div>

        <div className='flex gap-2'>
            <Button variant='secondary' isDisabled={isSaving} onPress={onAdd}>
                <Plus aria-hidden='true' className='size-4' />
                Add variable
            </Button>
            <Button isPending={isSaving} isDisabled={isSaving} onPress={onSave}>
                <Save aria-hidden='true' className='size-4' />
                Save changes
            </Button>
        </div>
    </div>
);

interface EnvironmentVariableRowProps{
    row: EnvVarRow;
    isFirst: boolean;
    onChange: (key: string, value: string) => void;
    onRemove: () => void;
}

const EnvironmentVariableRow = ({ row, isFirst, onChange, onRemove }: EnvironmentVariableRowProps) => (
    <div className='flex items-end gap-3'>
        <TextField
            className='flex-1'
            value={row.key}
            onChange={(key) => onChange(key, row.value)}
            validationBehavior='aria'
            fullWidth
        >
            {isFirst && <Label>Key</Label>}
            <Input placeholder='e.g. DATABASE_URL' autoComplete='off' />
        </TextField>

        <TextField
            className='flex-1'
            value={row.value}
            onChange={(value) => onChange(row.key, value)}
            validationBehavior='aria'
            fullWidth
        >
            {isFirst && <Label>Value</Label>}
            <Input placeholder='Value' autoComplete='off' />
        </TextField>

        <Button
            isIconOnly
            variant='ghost'
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
    const update = useMutation((body: UpdateDeploymentInput) => deploymentApi.update(deploymentId, body));

    const handleSave = async () => {
        const saved = await update
            .run({ environmentVariables: envVarRowsToMap(rows) })
            .then(() => true, () => false);

        if(saved) onSaved();
    };

    return (
        <>
            <EnvironmentVariablesHeader
                isSaving={update.loading}
                onAdd={() => setRows((current) => addEnvVarRow(current))}
                onSave={() => { void handleSave(); }}
            />

            <div className='mt-6 flex flex-1 flex-col gap-4'>
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
                    rows.map((row, index) => (
                        <EnvironmentVariableRow
                            key={index}
                            row={row}
                            isFirst={index === 0}
                            onChange={(key, value) => setRows((current) => updateEnvVarRow(current, index, key, value))}
                            onRemove={() => setRows((current) => removeEnvVarRow(current, index))}
                        />
                    ))
                )}

                {update.error !== undefined && <InlineError>{copy(update.error)}</InlineError>}
            </div>
        </>
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
    const environment = useQuery(deploymentApi.environment, [id]);

    if(id === undefined || environment.loading){
        return <CenterState className='h-full'><LoadingState title='Loading environment variables' compact /></CenterState>;
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
        <PageBody height='full'>
            <EnvironmentVariablesEditor
                key={data.deploymentId}
                deploymentId={data.deploymentId}
                environmentVariables={data.environmentVariables}
                onSaved={environment.reload}
            />
        </PageBody>
    );
};

export default EnvironmentVariables;
