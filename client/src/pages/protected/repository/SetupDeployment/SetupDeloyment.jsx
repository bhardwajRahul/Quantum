import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { updateRepository } from '@services/repository/operations';
import { Rocket } from 'lucide-react';
import { useDocumentTitle } from '@hooks/common';
import { PageHeader, BusyOverlay, Button } from '@components/atoms/kit';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const RUNTIME_OPTIONS = [
    ['node:18', 'Node 18'],
    ['node:20', 'Node 20'],
    ['node:22', 'Node 22'],
    ['python:3.11', 'Python 3.11'],
    ['python:3.12', 'Python 3.12'],
    ['go:1.22', 'Go 1.22'],
    ['static', 'Static']
];

const SetupDeployment = () => {
    const { isOperationLoading, error, selectedRepository } = useSelector((state) => state.repository);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    useDocumentTitle('Build & Development Setting');

    const initialRuntimePreset = selectedRepository?.runtime
        ? (selectedRepository.runtimeVersion
            ? `${selectedRepository.runtime}:${selectedRepository.runtimeVersion}`
            : selectedRepository.runtime)
        : 'node:20';

    const [form, setForm] = useState({
        alias: selectedRepository?.alias || '',
        runtimePreset: initialRuntimePreset,
        buildCommand: selectedRepository?.buildCommand || '',
        installCommand: selectedRepository?.installCommand || '',
        startCommand: selectedRepository?.startCommand || '',
        rootDirectory: selectedRepository?.rootDirectory || ''
    });

    useEffect(() => {
        if(!selectedRepository)
            return navigate('/dashboard/');
    }, []);

    const update = (key) => (event) => {
        setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

    const handleFormSubmit = (event) => {
        event.preventDefault();
        const { runtimePreset, ...rest } = form;
        const [runtime, runtimeVersion = ''] = (runtimePreset || '').split(':');
        dispatch(updateRepository(selectedRepository._id, { ...rest, runtime, runtimeVersion }, navigate));
    };

    return (
        <div>
            <BusyOverlay
                show={isOperationLoading}
                message='Applying build & development settings...'
            />

            <PageHeader
                title='Build & Development Setting'
                subtitle='We need to know some information about your project.'
            />

            {error && (
                <p className='mb-6 text-sm text-destructive'>{String(error)}</p>
            )}

            <form onSubmit={handleFormSubmit} className='max-w-2xl'>
                <div className='flex flex-col gap-7'>
                    <div className='space-y-1.5'>
                        <label className='text-sm font-medium text-foreground'>Alias</label>
                        <Input
                            placeholder='For example: "My Blog Application [Frontend]"'
                            value={form.alias}
                            onChange={update('alias')}
                        />
                        <p className='text-xs text-muted-foreground'>
                            Enter an alias to identify your repository within the platform. This must be unique in your account, that is, you must not have two or more repositories with the same alias.
                        </p>
                    </div>

                    <div className='space-y-1.5'>
                        <label className='text-sm font-medium text-foreground'>Runtime</label>
                        <Select
                            value={form.runtimePreset}
                            onValueChange={(value) => setForm((prev) => ({ ...prev, runtimePreset: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder='Select a runtime' />
                            </SelectTrigger>
                            <SelectContent>
                                {RUNTIME_OPTIONS.map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className='text-xs text-muted-foreground'>
                            The runtime and version used to build and run your application.
                        </p>
                    </div>

                    <div className='space-y-1.5'>
                        <label className='text-sm font-medium text-foreground'>Build command</label>
                        <Input
                            placeholder='`yarn build`, `pnpm build`, `npm build`, or `bun build`'
                            value={form.buildCommand}
                            onChange={update('buildCommand')}
                        />
                        <p className='text-xs text-muted-foreground'>
                            The command your framework provides for compiling your code. If your framework does not require a build, leave this field empty.
                        </p>
                    </div>

                    <div className='space-y-1.5'>
                        <label className='text-sm font-medium text-foreground'>Install command</label>
                        <Input
                            placeholder='`yarn install`, `pnpm install`, `npm install`, or `bun install`'
                            value={form.installCommand}
                            onChange={update('installCommand')}
                        />
                        <p className='text-xs text-muted-foreground'>
                            The command that is used to install your project dependencies. If you do not need to install dependencies, leave this field empty.
                        </p>
                    </div>

                    <div className='space-y-1.5'>
                        <label className='text-sm font-medium text-foreground'>Start command</label>
                        <Input
                            placeholder='`yarn start`, `pnpm start`, `npm start`, or `bun start`'
                            value={form.startCommand}
                            onChange={update('startCommand')}
                        />
                        <p className='text-xs text-muted-foreground'>
                            The command that is used to start your application. If you do not need to start your application, leave this field empty.
                        </p>
                    </div>

                    <div className='space-y-1.5'>
                        <label className='text-sm font-medium text-foreground'>Root directory</label>
                        <Input
                            placeholder='`/`, `/src`, `/client`, or `/server`'
                            value={form.rootDirectory}
                            onChange={update('rootDirectory')}
                        />
                        <p className='text-xs text-muted-foreground'>
                            The directory that contains your project. If your project is in the root directory, leave this field empty.
                        </p>
                    </div>

                    <div className='flex gap-2'>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => navigate('/dashboard/')}
                            disabled={isOperationLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type='submit'
                            disabled={isOperationLoading}
                        >
                            <Rocket className='h-4 w-4' /> Continue
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default SetupDeployment;
