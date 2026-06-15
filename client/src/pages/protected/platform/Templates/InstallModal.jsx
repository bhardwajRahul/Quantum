/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
****/

import { useEffect, useMemo, useState } from 'react';
import { templates } from '@services/platform/service';
import { Button } from '@components/atoms/kit';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { truncate } from '@utilities/common/truncate';

const InstallModal = ({ template, projectId, onClose, onInstalled }) => {
    const schema = useMemo(() => (Array.isArray(template?.inputsSchema) ? template.inputsSchema : []), [template]);

    const [name, setName] = useState('');
    const [inputs, setInputs] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Seed inputs with schema defaults whenever a template is opened.
    useEffect(() => {
        const seeded = {};
        schema.forEach((field) => {
            seeded[field.key] = field.default ?? (field.type === 'boolean' ? false : '');
        });
        setInputs(seeded);
        setName('');
        setError('');
        setSuccess(false);
    }, [template, schema]);

    const setField = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async () => {
        setError('');
        if(!projectId){
            setError('Select a project to install.');
            return;
        }
        if(!name.trim()){
            setError('A name for this install is required.');
            return;
        }
        const id = template?._id || template?.id;
        try{
            setSubmitting(true);
            await templates.installInProject({
                query: { params: { projectId } },
                body: { templateId: id, name: name.trim(), inputs }
            });
            setSuccess(true);
            onInstalled?.();
        }catch(err){
            setError(typeof err === 'string' ? err : 'Failed to queue the install. Please try again.');
        }finally{
            setSubmitting(false);
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
        if(field.type === 'secret'){
            return (
                <div key={field.key} className='space-y-1.5'>
                    <label className='text-sm font-medium'>{label}</label>
                    <Input
                        type='password'
                        value={value ?? ''}
                        placeholder={field.default != null ? String(field.default) : ''}
                        onChange={(e) => setField(field.key, e.target.value)}
                    />
                </div>
            );
        }
        return (
            <div key={field.key} className='space-y-1.5'>
                <label className='text-sm font-medium'>{label}</label>
                <Input
                    type={field.type === 'number' ? 'number' : 'text'}
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
                            {error && (
                                <p className='text-sm text-destructive'>{error}</p>
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
                        disabled={submitting || (!success && !projectId)}
                    >
                        {success ? 'Done' : (submitting ? 'Deploying…' : 'Deploy')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default InstallModal;
