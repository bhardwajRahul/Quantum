import { Input, Label, TextField } from '@heroui/react';
import typia from 'typia';
import SingleFieldDialog from '@/shared/components/SingleFieldDialog';
import InlineError from '@/shared/components/InlineError';
import { useForm } from '@/shared/hooks/forms/use-form';
import { domainApi } from '@/modules/domain/api/api';
import { domainErrorMessages } from '@/modules/domain/utils/error-messages';
import type { CreateUpstreamDomainInput } from '@quantum/contracts/modules/domain/http';

interface CreateUpstreamDialogProps{
    onClose: () => void;
    onCreated: () => void;
}

const CreateUpstreamDialog = ({ onClose, onCreated }: CreateUpstreamDialogProps) => {
    const form = useForm<CreateUpstreamDomainInput>({
        validate: typia.createValidate<CreateUpstreamDomainInput>(),
        initialValues: { host: '', upstreamUrl: '' },
        submitErrorMessages: domainErrorMessages,
        onSubmit: async (values) => {
            await domainApi.createUpstream({
                body: { host: values.host.trim(), upstreamUrl: values.upstreamUrl.trim() }
            });
            onCreated();
            onClose();
        }
    });

    const upstream = form.field('upstreamUrl');

    return (
        <SingleFieldDialog
            isOpen
            onOpenChange={(isOpen) => { if(!isOpen && !form.submitting) onClose(); }}
            onCancel={onClose}
            title='Proxy a host'
            form={form}
            fieldName='host'
            fieldLabel='Host'
            fieldPlaceholder='jellyfin.example.com'
            submitLabel='Add route'
            extra={(
                <div className='flex flex-col gap-1.5'>
                    <Label>Upstream</Label>
                    <TextField
                        value={upstream.value}
                        onChange={upstream.onChange}
                        onBlur={upstream.onBlur}
                        isInvalid={upstream.isInvalid}
                        isDisabled={form.submitting}
                        validationBehavior='aria'
                        fullWidth
                    >
                        <Input placeholder='http://192.168.1.50:8096' autoComplete='off' />
                    </TextField>

                    {upstream.errorMessage !== undefined && (
                        <InlineError>{upstream.errorMessage}</InlineError>
                    )}

                    {}
                    <p className='text-[0.8125rem] text-muted'>
                        Reached from the proxy, not from your browser. A container name, a LAN address
                        or any host this server can talk to.
                    </p>
                </div>
            )}
        />
    );
};

export default CreateUpstreamDialog;
