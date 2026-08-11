import { Button } from '@heroui/react';
import InlineError from '@/shared/components/InlineError';
import Modal from '@/shared/components/Modal';

interface ConfirmDialogProps{
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: string;
    description: string;
    confirmLabel: string;
    isPending: boolean;
    error: string | null;
    onConfirm: () => void;
}

const ConfirmDialog = ({
    isOpen,
    onOpenChange,
    title,
    description,
    confirmLabel,
    isPending,
    error,
    onConfirm
}: ConfirmDialogProps) => (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} title={title}>
        <div className='flex flex-col gap-4'>
            <p className='text-[0.875rem] text-muted'>{description}</p>

            {error ? (
                <InlineError>{error}</InlineError>
            ) : null}

            <div className='flex justify-end gap-2'>
                <Button variant='secondary' onPress={() => onOpenChange(false)}>Cancel</Button>
                <Button variant='danger' isPending={isPending} onPress={onConfirm}>{confirmLabel}</Button>
            </div>
        </div>
    </Modal>
);

export default ConfirmDialog;
