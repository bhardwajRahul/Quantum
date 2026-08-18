import { AlertDialog, Button } from '@heroui/react';
import InlineError from '@/shared/components/InlineError';

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
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <AlertDialog.Container>
            <AlertDialog.Dialog>
                <AlertDialog.CloseTrigger />

                <AlertDialog.Header>
                    <AlertDialog.Icon status='danger' />
                    <AlertDialog.Heading>{title}</AlertDialog.Heading>
                </AlertDialog.Header>

                <AlertDialog.Body>
                    <p className='text-[0.875rem] text-muted'>{description}</p>
                    {error ? <InlineError className='mt-4'>{error}</InlineError> : null}
                </AlertDialog.Body>

                <AlertDialog.Footer>
                    <Button slot='close' variant='secondary'>Cancel</Button>
                    <Button variant='danger' isPending={isPending} onPress={onConfirm}>{confirmLabel}</Button>
                </AlertDialog.Footer>
            </AlertDialog.Dialog>
        </AlertDialog.Container>
    </AlertDialog.Backdrop>
);

export default ConfirmDialog;
