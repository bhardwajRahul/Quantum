const viaTextArea = (value: string): boolean => {
    if(typeof document.execCommand !== 'function') return false;

    const helper = document.createElement('textarea');
    helper.value = value;
    helper.setAttribute('readonly', '');
    helper.style.position = 'absolute';
    helper.style.left = '-9999px';
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand('copy');
    helper.remove();
    return copied;
};

export const copyText = async (value: string): Promise<boolean> => {
    if(typeof navigator.clipboard?.writeText === 'function'){
        try{
            await navigator.clipboard.writeText(value);
            return true;
        }catch{
            return viaTextArea(value);
        }
    }

    return viaTextArea(value);
};
