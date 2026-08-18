import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

const PasswordInput = ({ className, ...props }) => {
    const [show, setShow] = useState(false);
    return (
        <div className='relative'>
            <Input
                type={show ? 'text' : 'password'}
                className={`pr-10${className ? ' ' + className : ''}`}
                {...props}
            />
            <button
                type='button'
                onClick={() => setShow((v) => !v)}
                className='absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-primary transition-colors'
                aria-label={show ? 'Hide password' : 'Show password'}
            >
                {show ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
            </button>
        </div>
    );
};

export default PasswordInput;
