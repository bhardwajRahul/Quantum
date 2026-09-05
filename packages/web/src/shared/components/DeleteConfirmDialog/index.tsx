import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { useMutation } from '@/shared/hooks/api/use-mutation';

interface DeleteConfirmDialogProps{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    entityId: number | null;
    remove: (id: number) => Promise<unknown>;
    getErrorMessage: (error: Error | undefined) => string | null;
    /**
     * Drops the row from the list the instant Delete is pressed, and returns the undo.
     * Called before the request, so the table behind the dialog is already right when it
     * closes; a rejection puts the row back and the error stays on the open dialog.
     */
    optimistic?: () => () => void;
    onClose: () => void;
    onRemoved: () => void;
}

const DeleteConfirmDialog = ({
    isOpen,
    title,
    description,
    confirmLabel = 'Delete',
    entityId,
    remove,
    getErrorMessage,
    optimistic,
    onClose,
    onRemoved
}: DeleteConfirmDialogProps) => {
    const mutation = useMutation((id: number) => remove(id));

    const handleConfirm = async () => {
        if(entityId === null) return;

        const rollback = optimistic?.();
        const removed = await mutation.run(entityId).then(() => true, () => false);
        if(!removed){
            rollback?.();
            return;
        }

        onClose();
        onRemoved();
    };

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            isPending={mutation.loading}
            error={getErrorMessage(mutation.error)}
            onConfirm={() => { void handleConfirm(); }}
        />
    );
};

export default DeleteConfirmDialog;
