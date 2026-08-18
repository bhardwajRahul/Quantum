import { useEffect, useState } from 'react';
import { templates } from '@services/platform/service';
import { Button } from '@components/atoms/kit';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAsyncAction } from '@hooks/common';
import { truncate } from '@utilities/common/truncate';

const InstallModal = ({ template, projectId, onClose, onInstalled }) => {
    const schema = Array.isArray(template?.inputsSchema) ? template.inputsSchema : [];

    const [name, setName] = useState('');
    const [inputs, setInputs] = useState({});
    const [success, setSuccess] = useState(false);

    const submit = useAsyncAction({ fallback: 'Failed to queue the install. Please try again.' });

    useEffect(() => {
        const seeded = {};
        schema.forEach((field) => {
            seeded[field.key] = field.default ?? (field.type === 'boolean' ? false : '');
        });
        setInputs(seeded);
        setName('');
        setSuccess(false);
        submit.clearError();
    }, [template]);

    const setField = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async () => {
        if(!projectId || !name.trim()) return;
        const id = template?._id || template?.id;
        const ok = await submit.run(() => templates.installInProject({
            query: { params: { projectId } },
            body: { template: id, name: name.trim(), inputs }
        }));
        if(ok){
            setSuccess(true);
            onInstalled?.();
        }
    };

    const renderField = (field) => {
        const value = inputs[field.key];
        const label = `${field.label || field.key}${field.required ? ' *' : ''}`;
        if(field.type === 'boolean'){
            return (
                <label key={field.key} className='flex items-center gap-2 text-sm font-medium'>
                    <input
                        type='checkbox'
                        className='h-4 w-4 rounded border-border'
                        checked={!!value}
                        onChange={(e) => setField(field.key, e.target.checked)}
                    />
                    {label}
                </label>
            );
        }
        const inputType = field.type === 'secret' ? 'password' : field.type === 'number' ? 'number' : 'text';
        return (
            <div key={field.key} className='space-y-1.5'>
                <label className='text-sm font-medium'>{label}</label>
                <Input
                    type={inputType}
                    value={value ?? ''}
                    placeholder={field.default != null ? String(field.default) : ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                />
            </div>
        );
    };

    return (
        <Dialog open={!!template} onOpenChange={(o) => { if(!o) onClose(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{`Deploy ${template?.name || ''}`}</DialogTitle>
                    <DialogDescription>
                        {truncate(template?.description, 160) || 'Provide the configuration below to queue this template.'}
                    </DialogDescription>
                </DialogHeader>
                <div className='flex flex-col gap-5'>
                    {success ? (
                        <p className='rounded-md bg-success/10 px-3 py-2 text-sm text-success'>
                            {`Your "${name}" deployment is being provisioned and will appear under "Your installs" shortly.`}
                        </p>
                    ) : (
                        <>
                            {!projectId && (
                                <p className='rounded-md bg-warning/10 px-3 py-2 text-sm text-warning'>
                                    Select a project to install.
                                </p>
                            )}
                            <div className='space-y-1.5'>
                                <label className='text-sm font-medium'>Name *</label>
                                <Input
                                    placeholder='my-app'
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            {schema.map(renderField)}
                            {submit.error && (
                                <p className='text-sm text-destructive'>{submit.error}</p>
                            )}
                        </>
                    )}
                </div>
                <DialogFooter>
                    {!success && (
                        <Button variant='outline' onClick={onClose}>Cancel</Button>
                    )}
                    <Button
                        onClick={success ? onClose : handleSubmit}
                        disabled={submit.pending || (!success && (!projectId || !name.trim()))}
                    >
                        {success ? 'Done' : (submit.pending ? 'Deploying…' : 'Deploy')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default InstallModal;
