import React, { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2, Save, KeyRound } from 'lucide-react';
import { useDocumentTitle } from '@hooks/common';
import { PageHeader, EmptyState, LoadingBlock, BusyOverlay, Button } from '@components/atoms/kit';
import { Input } from '@/components/ui/input';
import * as deploymentSlice from '@services/deployment/slice';
import * as deploymentOperations from '@services/deployment/operations';

const EnvironVariables = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { repositoryAlias } = useParams();
    const { selectedRepository } = useSelector((state) => state.repository);
    const {
        isEnvironmentLoading,
        isOperationLoading,
        environment } = useSelector((state) => state.deployment);
    useDocumentTitle('Environment Variables');

    useEffect(() => {
        if(!selectedRepository){
            navigate('/dashboard');
            return;
        }
        dispatch(deploymentOperations.getActiveDeploymentEnvironment(selectedRepository.alias));
    }, [dispatch, selectedRepository, navigate]);

    const updateHandler = useCallback((variables) => {
        const updatedEnvironment = { ...environment, variables };
        dispatch(deploymentSlice.setState({
            path: 'environment',
            value: updatedEnvironment
        }));
    }, [dispatch, environment]);

    const onVariableChange = useCallback((index, newKey, newValue) => {
        if(!environment || !Array.isArray(environment.variables)) return;
        const updatedVariables = environment.variables.map((variable, i) => (
            i === index ? [newKey, newValue] : variable
        ));
        updateHandler(updatedVariables);
    }, [environment, updateHandler]);

    const onRemove = useCallback((index) => {
        if(!environment || !Array.isArray(environment.variables)) return;
        const updatedVariables = environment.variables.filter((_, i) => i !== index);
        updateHandler(updatedVariables);
    }, [environment, updateHandler]);

    const onCreateNew = useCallback(() => {
        const variables = environment?.variables || [];
        if(variables.length && !variables[0][0].length) return;
        updateHandler([['', ''], ...variables]);
    }, [environment, updateHandler]);

    const onSave = useCallback(() => {
        if(!environment || !environment.variables){
            console.error('Environment data is missing.');
            return;
        }
        const variablesObject = environment.variables.reduce((acc, [key, value]) => {
            if(key.trim() !== '') acc[key] = value;
            return acc;
        }, {});
        const updatedEnvironment = { ...environment, variables: variablesObject };
        dispatch(deploymentOperations.updateDeployment(updatedEnvironment._id, { environment: updatedEnvironment }, navigate));
    }, [dispatch, environment, navigate]);

    const variables = environment?.variables || [];

    return (
        <div>
            <BusyOverlay
                show={isOperationLoading}
                message='Recreating container with the new configuration...'
            />

            <PageHeader
                title='Environment Variables'
                subtitle='To provide your implementation with environment variables at compile and run time, you can enter them right here. If there are any .env files in the root of your repository, these are mapped and loaded automatically when deploying.'
                actions={(
                    <>
                        <Button
                            variant='outline'
                            onClick={() => navigate('/dashboard/')}
                            disabled={isOperationLoading}
                        >
                            Go back
                        </Button>
                        <Button
                            variant='outline'
                            onClick={onCreateNew}
                            disabled={isEnvironmentLoading || isOperationLoading}
                        >
                            <Plus className='h-4 w-4' /> Add variable
                        </Button>
                        <Button
                            onClick={onSave}
                            disabled={isEnvironmentLoading || isOperationLoading}
                        >
                            <Save className='h-4 w-4' /> Save changes
                        </Button>
                    </>
                )}
            />

            {isEnvironmentLoading ? (
                <LoadingBlock label='Loading environment variables' />
            ) : variables.length === 0 ? (
                <EmptyState
                    icon={KeyRound}
                    title='No environment variables'
                    body='There are no environment variables to display.'
                    action={(
                        <Button onClick={onCreateNew}>
                            <Plus className='h-4 w-4' /> Create new variable
                        </Button>
                    )}
                />
            ) : (
                <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
                    <div className='flex flex-col gap-4 max-w-3xl'>
                        {variables.map(([key, value], index) => (
                            <div key={index} className='flex items-end gap-3'>
                                <div className='flex-1 space-y-1.5'>
                                    {index === 0 && (
                                        <label className='block text-xs font-medium text-muted-foreground'>Key</label>
                                    )}
                                    <Input
                                        placeholder='e.g. CLIENT_KEY'
                                        value={key}
                                        onChange={(e) => onVariableChange(index, e.target.value, value)}
                                    />
                                </div>
                                <div className='flex-1 space-y-1.5'>
                                    {index === 0 && (
                                        <label className='block text-xs font-medium text-muted-foreground'>Value</label>
                                    )}
                                    <Input
                                        placeholder='Enter a value for the variable.'
                                        value={value}
                                        onChange={(e) => onVariableChange(index, key, e.target.value)}
                                    />
                                </div>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    className='shrink-0 text-destructive'
                                    onClick={() => onRemove(index)}
                                    aria-label='Remove variable'
                                >
                                    <Trash2 className='h-4 w-4' />
                                </Button>
                            </div>
                        ))}
                    </div>
                </form>
            )}
        </div>
    );
};

export default EnvironVariables;
