import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { StatusBadge, LoadingBlock } from '@components/atoms/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { environments } from '@services/platform/service';
import { useAsyncAction } from '@hooks/common';
import { errText } from '@utilities/common/errText';
import { unwrapList } from '@utilities/api/unwrap';

const ENV_TYPES = [
    { value: 'production', label: 'Production' },
    { value: 'staging', label: 'Staging' },
    { value: 'preview', label: 'Preview' }
];

const EnvironmentsModal = ({ project, onClose }) => {
    const projectId = project?._id;
    const [loading, setLoading] = useState(false);
    const [list, setList] = useState([]);
    const [error, setError] = useState(null);

    const [name, setName] = useState('');
    const [type, setType] = useState('production');
    const [deletingId, setDeletingId] = useState(null);

    const create = useAsyncAction({ fallback: 'Failed to create environment.' });
    const remove = useAsyncAction({ onError: setError, fallback: 'Failed to delete environment.' });

    const load = useCallback(async () => {
        if(!projectId) return;
        setLoading(true);
        setError(null);
        try{
            const res = await environments.listByProject({ query: { params: { projectId } } });
            setList(unwrapList(res));
        }catch(err){
            setError(errText(err, 'Failed to load environments.'));
        }finally{
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if(!name.trim() || !projectId) return;
        const ok = await create.run(() => environments.createInProject({
            query: { params: { projectId } },
            body: { name: name.trim(), type }
        }));
        if(ok){
            setName('');
            setType('production');
            await load();
        }
    };

    const handleDelete = async (env) => {
        setDeletingId(env._id);
        if(await remove.run(() => environments.remove({ query: { params: { id: env._id } } }))){
            await load();
        }
        setDeletingId(null);
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{`Environments · ${project?.name || ''}`}</DialogTitle>
                    <DialogDescription>
                        Environments isolate deployments (production, staging, preview) within this project.
                    </DialogDescription>
                </DialogHeader>

                <div className='flex flex-col gap-6'>
                    {error && <p className='text-sm text-destructive'>{error}</p>}

                    {loading ? (
                        <LoadingBlock label='Loading environments' />
                    ) : list.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>
                            No environments yet. Create the first one below.
                        </p>
                    ) : (
                        <div className='flex flex-col gap-3'>
                            {list.map((env) => (
                                <div
                                    key={env._id}
                                    className='flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border'
                                >
                                    <span className='inline-flex items-center gap-2'>
                                        <span className='text-sm text-foreground'>{env.name}</span>
                                        <StatusBadge status={env.type || 'production'} />
                                    </span>
                                    <Button
                                        variant='ghost'
                                        size='icon'
                                        disabled={deletingId === env._id}
                                        onClick={() => handleDelete(env)}
                                        aria-label='Delete environment'
                                        className='text-destructive'
                                    >
                                        <Trash2 className='h-4 w-4' />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className='flex flex-col gap-4'>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>New environment name</label>
                            <Input
                                placeholder='production'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <label className='text-sm font-medium'>Type</label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger><SelectValue placeholder='Type' /></SelectTrigger>
                                <SelectContent>
                                    {ENV_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {create.error && <p className='text-sm text-destructive'>{create.error}</p>}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant='outline' onClick={onClose}>Close</Button>
                    <Button onClick={handleCreate} disabled={create.pending || !name.trim()}>
                        {create.pending ? 'Creating…' : 'Create environment'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EnvironmentsModal;
