import React, { useEffect, useMemo, useState } from 'react';
import { getMyGithubRepositories, createRepository, detectFramework } from '@services/repository/operations';
import { authenticate } from '@services/github/operations';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Github, ArrowRight, Rocket, Search, Loader2 } from 'lucide-react';
import { useDocumentTitle } from '@hooks/common';
import { PageHeader, EmptyState, LoadingBlock, BusyOverlay, Button, Pill, Card, CardContent } from '@components/atoms/kit';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const DEFAULT_VERSION = { node: '20', python: '3.12', go: '1.22', static: '' };

const RUNTIME_OPTIONS = [
    ['node', 'Node.js'],
    ['python', 'Python'],
    ['go', 'Go'],
    ['static', 'Static']
];

const BLANK_CONFIG = {
    runtime: 'node',
    installCommand: '',
    buildCommand: '',
    startCommand: '',
    outputDirectory: ''
};

const CreateRepository = () => {
    const { githubRepositories, isLoading, isOperationLoading, error, detectedPreset } = useSelector(state => state.repository);
    const { user } = useSelector(state => state.auth);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [selectedOwner, setSelectedOwner] = useState('');
    const [query, setQuery] = useState('');
    const [branch, setBranch] = useState('');
    const [deploying, setDeploying] = useState(false);

    const [config, setConfig] = useState(BLANK_CONFIG);
    useDocumentTitle('Create Repository');

    const dispatch = useDispatch();
    const navigate = useNavigate();

    const githubConnected = !!user?.github?._id;

    useEffect(() => {

        if(githubConnected) dispatch(getMyGithubRepositories());
    }, [githubConnected]);

    useEffect(() => {
        if(!detectedPreset) return;
        setConfig({
            runtime: detectedPreset.runtime || 'node',
            installCommand: detectedPreset.installCommand || '',
            buildCommand: detectedPreset.buildCommand || '',
            startCommand: detectedPreset.startCommand || '',
            outputDirectory: detectedPreset.outputDirectory || ''
        });
    }, [detectedPreset]);

    const handleRepoSelection = (repository) => {
        dispatch(detectFramework(repository.owner.login, repository.name));
        setSelectedRepo(repository);
        setBranch(repository.default_branch || (repository.branches && repository.branches[0]) || '');
        setConfig(BLANK_CONFIG);
    };

    const handleDeploy = async () => {
        if(!selectedRepo) return;
        const runtime = config.runtime || 'node';
        const body = {
            name: selectedRepo.name,
            owner: selectedRepo.owner.login,
            url: selectedRepo.html_url,
            user: user._id,
            branch,
            framework: detectedPreset?.framework,
            runtime,
            runtimeVersion: DEFAULT_VERSION[runtime] ?? '',
            installCommand: config.installCommand,
            buildCommand: config.buildCommand,
            startCommand: config.startCommand,
            outputDirectory: config.outputDirectory
        };
        setDeploying(true);
        await dispatch(createRepository(body, navigate));
    };

    const updateConfig = (key) => (event) => {
        setConfig((prev) => ({ ...prev, [key]: event.target.value }));
    };

    const owners = useMemo(
        () => [...new Map(githubRepositories.map((r) => [r.owner.login, r.owner])).values()],
        [githubRepositories]
    );

    const visibleRepositories = useMemo(() => {
        const term = query.trim().toLowerCase();
        return githubRepositories
            .filter((r) => (selectedOwner ? r.owner.login === selectedOwner : true))
            .filter((r) => (term ? r.name.toLowerCase().includes(term) : true));
    }, [githubRepositories, selectedOwner, query]);

    const detecting = isOperationLoading && !deploying;

    if(!githubConnected){
        return (
            <div>
                <PageHeader
                    title='Connect GitHub to deploy'
                    subtitle='Quantum deploys applications straight from your GitHub repositories.'
                />
                <EmptyState
                    icon={Github}
                    title='Connect your GitHub account'
                    body='Link your GitHub account so Quantum can import a repository and build, deploy, and run it for you.'
                    action={(
                        <Button onClick={() => authenticate(user._id)}>
                            <Github className='h-4 w-4' /> Connect GitHub
                        </Button>
                    )}
                />
            </div>
        );
    }

    return (
        <div>
            <BusyOverlay
                show={deploying}
                message='Cloning and adjusting parameters in your repository...'
            />

            <PageHeader
                title={selectedRepo ? "We're almost ready..." : "Let's start our teamwork..."}
                subtitle={selectedRepo
                    ? 'Pick the branch to deploy. Build settings are auto-detected and editable here.'
                    : 'To deploy a new project, import an existing Git repository.'}
            />

            {error && (
                <p className='mb-6 text-sm text-destructive'>{String(error)}</p>
            )}

            {selectedRepo ? (
                <div className='flex flex-col gap-6 max-w-2xl'>
                    <Card>
                        <CardContent className='flex items-center gap-3 p-4'>
                            <Github className='h-5 w-5 text-muted-foreground' />
                            <span className='text-base font-semibold text-foreground'>
                                {selectedRepo.owner.login}/{selectedRepo.name}
                            </span>
                        </CardContent>
                    </Card>

                    <form onSubmit={(e) => { e.preventDefault(); handleDeploy(); }}>
                        <div className='flex flex-col gap-6'>
                            <div className='space-y-1.5'>
                                <label className='text-sm font-medium text-foreground'>Branch</label>
                                <Select
                                    value={branch}
                                    onValueChange={(value) => setBranch(value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder='Select a branch' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(selectedRepo.branches || []).map((b) => (
                                            <SelectItem key={b} value={b}>
                                                {b === selectedRepo.default_branch ? `${b} (default)` : b}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className='text-xs text-muted-foreground'>
                                    The branch Quantum will deploy from.
                                </p>
                            </div>

                            {detecting ? (
                                <div className='flex items-center gap-3 text-muted-foreground'>
                                    <Loader2 className='h-4 w-4 animate-spin text-primary' />
                                    <span className='text-sm'>Auto-detecting framework and build settings...</span>
                                </div>
                            ) : (
                                <>
                                    <div className='space-y-1.5'>
                                        <label className='text-sm font-medium text-foreground'>Runtime</label>
                                        <Select
                                            value={config.runtime}
                                            onValueChange={(value) => setConfig((prev) => ({ ...prev, runtime: value }))}
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
                                            The runtime used to build and run your application.
                                        </p>
                                    </div>

                                    <div className='space-y-1.5'>
                                        <label className='text-sm font-medium text-foreground'>Install command</label>
                                        <Input
                                            placeholder='`npm install`, `yarn install`, `pnpm install`...'
                                            value={config.installCommand}
                                            onChange={updateConfig('installCommand')}
                                        />
                                    </div>
                                    <div className='space-y-1.5'>
                                        <label className='text-sm font-medium text-foreground'>Build command</label>
                                        <Input
                                            placeholder='`npm run build`, `yarn build`...'
                                            value={config.buildCommand}
                                            onChange={updateConfig('buildCommand')}
                                        />
                                    </div>
                                    <div className='space-y-1.5'>
                                        <label className='text-sm font-medium text-foreground'>Start command</label>
                                        <Input
                                            placeholder='`npm start`, `yarn start`...'
                                            value={config.startCommand}
                                            onChange={updateConfig('startCommand')}
                                        />
                                    </div>
                                    <div className='space-y-1.5'>
                                        <label className='text-sm font-medium text-foreground'>Output directory</label>
                                        <Input
                                            placeholder='`dist`, `build`, `out`...'
                                            value={config.outputDirectory}
                                            onChange={updateConfig('outputDirectory')}
                                        />
                                    </div>
                                </>
                            )}

                            <div className='flex gap-2'>
                                <Button
                                    type='button'
                                    variant='outline'
                                    onClick={() => setSelectedRepo(null)}
                                    disabled={deploying}
                                >
                                    Back
                                </Button>
                                <Button
                                    type='submit'
                                    disabled={detecting || deploying || !branch}
                                >
                                    <Rocket className='h-4 w-4' /> Deploy
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : (
                <div className='flex flex-col gap-6'>
                    <div className='flex flex-wrap items-end gap-4'>
                        <div className='flex-1 min-w-[320px] space-y-1.5'>
                            <label className='text-sm font-medium text-foreground'>Search repositories</label>
                            <div className='relative'>
                                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                                <Input
                                    placeholder='Search repositories'
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className='pl-9'
                                />
                            </div>
                        </div>
                        {owners.length > 1 && (
                            <div className='w-72 space-y-1.5'>
                                <label className='text-sm font-medium text-foreground'>Account</label>
                                <Select
                                    value={selectedOwner || '__all__'}
                                    onValueChange={(value) => setSelectedOwner(value === '__all__' ? '' : value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder='All accounts & organizations' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='__all__'>All accounts & organizations</SelectItem>
                                        {owners.map((owner) => (
                                            <SelectItem key={owner.login} value={owner.login}>{owner.login}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {isLoading ? (
                        <LoadingBlock label='Loading repositories' />
                    ) : visibleRepositories.length === 0 ? (
                        <EmptyState
                            icon={Github}
                            title='No repositories found'
                            body='There are no repositories in your GitHub account that match.'
                            action={(
                                <Button onClick={() => window.open('https://github.com/', '_blank')}>
                                    Go to GitHub
                                </Button>
                            )}
                        />
                    ) : (
                        <div className='flex flex-col gap-3'>
                            {visibleRepositories.map((repository) => (
                                <Card
                                    key={`${repository.owner.login}/${repository.name}`}
                                    onClick={() => handleRepoSelection(repository)}
                                    className='group cursor-pointer transition-colors hover:bg-accent'
                                >
                                    <CardContent className='flex items-center justify-between gap-3 p-4'>
                                        <div className='flex min-w-0 items-center gap-3'>
                                            <Github className='h-5 w-5 shrink-0 text-muted-foreground' />
                                            <span className='truncate text-sm font-medium text-foreground'>
                                                {repository.name}
                                            </span>
                                            <Pill tone={repository.private ? 'gray' : 'green'}>
                                                {repository.private ? 'Private' : 'Public'}
                                            </Pill>
                                        </div>
                                        <ArrowRight className='h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CreateRepository;
