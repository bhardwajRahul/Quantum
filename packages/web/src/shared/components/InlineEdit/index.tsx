import { useEffect, useRef, useState } from 'react';
import { cn } from '@heroui/react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

interface InlineEditProps{
    value: string;
    onCommit: (value: string) => Promise<unknown> | unknown;
    ariaLabel: string;
    className?: string;
    isDisabled?: boolean;
}

const InlineEdit = ({ value, onCommit, ariaLabel, className, isDisabled = false }: InlineEditProps) => {
    const ref = useRef<HTMLSpanElement | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if(!editing || node === null) return;
        node.focus();
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }, [editing]);

    const restore = () => {
        if(ref.current) ref.current.textContent = value;
    };

    const commit = async () => {
        const next = (ref.current?.textContent ?? '').replace(/\s+/g, ' ').trim();
        setEditing(false);
        ref.current?.blur();
        if(next === '' || next === value){
            restore();
            return;
        }
        setSaving(true);
        try{
            await onCommit(next);
        }catch{
            restore();
        }finally{
            setSaving(false);
        }
    };

    const cancel = () => {
        restore();
        setEditing(false);
        ref.current?.blur();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
        if(!editing){
            if(event.key === 'Enter' && !isDisabled){
                event.preventDefault();
                setEditing(true);
            }
            return;
        }
        if(event.key === 'Enter'){
            event.preventDefault();
            void commit();
        }else if(event.key === 'Escape'){
            event.preventDefault();
            cancel();
        }
    };

    const onPaste = (event: ClipboardEvent<HTMLSpanElement>) => {
        event.preventDefault();
        document.execCommand('insertText', false, event.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
    };

    return (
        <span
            ref={ref}
            role='textbox'
            aria-label={ariaLabel}
            aria-readonly={!editing}
            title={editing ? undefined : 'Click to rename'}
            tabIndex={isDisabled ? -1 : 0}
            contentEditable={editing ? 'plaintext-only' : false}
            suppressContentEditableWarning
            spellCheck={false}
            className={cn(
                'block min-w-0 outline-none',
                editing ? 'whitespace-nowrap' : 'cursor-text truncate',
                saving && 'opacity-60',
                className
            )}
            onClick={() => { if(!isDisabled && !saving) setEditing(true); }}
            onKeyDown={onKeyDown}
            onBlur={() => { if(editing) void commit(); }}
            onPaste={onPaste}
        >
            {value}
        </span>
    );
};

export default InlineEdit;
