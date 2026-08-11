import type { ReactNode } from 'react';

interface AuthShellProps{
    children: ReactNode;
}

const AuthShell = ({ children }: AuthShellProps) => (
    <main className='screen-view flex min-h-dvh items-center justify-center bg-background p-4'>
        <section className='w-full max-w-sm'>{children}</section>
    </main>
);

export default AuthShell;
