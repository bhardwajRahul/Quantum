import {
    ModalBackdrop,
    ModalContainer,
    ModalDialog,
    ModalCloseTrigger,
    ModalHeader,
    ModalHeading,
    ModalBody
} from '@heroui/react';
import type { ReactNode } from 'react';

interface ModalProps{
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: string;
    children: ReactNode;
}

const Modal = ({ isOpen, onOpenChange, title, children }: ModalProps) => (
    <ModalBackdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContainer>
            <ModalDialog>
                <ModalCloseTrigger />

                <ModalHeader>
                    <ModalHeading className='break-words'>{title}</ModalHeading>
                </ModalHeader>

                <ModalBody>{children}</ModalBody>
            </ModalDialog>
        </ModalContainer>
    </ModalBackdrop>
);

export default Modal;
