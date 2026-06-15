/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * SetupOrganization — the mandatory first-run gate. Under the explicit-org-setup
 * model the backend no longer auto-creates a "personal organization" at signup,
 * so a freshly registered user (or anyone who deleted their last org) has zero
 * organizations. The OrgGate renders this fullscreen screen (no AppShell chrome)
 * until they create their first org. Creating it provisions, on the server side,
 * the org's default project/environment AND the personal web-shell container, so
 * once it exists the whole app becomes usable.
 *
 * Reuses the org-creation flow from OrganizationSettings (organizations.create);
 * on success it re-bootstraps tenancy so the gate re-renders with the new org.
****/

import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { organizations } from '@services/platform/service';
import { bootstrapTenancy } from '@services/tenancy/operations';
import { useDocumentTitle } from '@hooks/common';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { errText } from '@utilities/common/errText';

const SetupOrganization = () => {
    const dispatch = useDispatch();
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    useDocumentTitle('Create your organization');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if(!name.trim() || creating) return;
        setCreating(true);
        setError(null);
        try{
            await organizations.create({ body: { name: name.trim() } });
            // Re-bootstrap tenancy: loads the new org (the only one), selects it,
            // persists qt-org, and flips organizations.length to 1 so OrgGate opens.
            await dispatch(bootstrapTenancy({}));
        }catch(err){
            setError(errText(err, 'Failed to create organization.'));
            setCreating(false);
        }
    };

    return (
        <div className='min-h-screen grid place-items-center bg-background px-4 py-8'>
            <Card className='w-full max-w-md'>
                <CardContent className='p-8'>
                    <div className='mb-8'>
                        <div className='mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                            <Building2 className='h-6 w-6' />
                        </div>
                        <p className='text-xs font-semibold uppercase tracking-[0.2em] text-primary'>
                            Quantum
                        </p>
                        <h1 className='mt-3 text-2xl font-semibold tracking-tight text-foreground'>
                            Create your organization
                        </h1>
                        <p className='mt-1 text-sm text-muted-foreground'>
                            Everything in Quantum — projects, applications, databases — lives inside an
                            organization. Create one to get started.
                        </p>
                    </div>

                    {error && (
                        <p className='mb-6 text-sm text-destructive'>
                            {String(error)}
                        </p>
                    )}

                    <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
                        <div className='space-y-1.5'>
                            <label htmlFor='setup-org-name' className='text-sm font-medium text-foreground'>
                                Organization name
                            </label>
                            <Input
                                id='setup-org-name'
                                name='name'
                                placeholder='my-organization'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>
                        <Button type='submit' disabled={creating || !name.trim()} className='w-full'>
                            {creating ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
                            {creating ? 'Creating…' : 'Create organization'}
                            {!creating && <ArrowRight className='h-4 w-4' />}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default SetupOrganization;
