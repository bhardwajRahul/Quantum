import type { ReactNode } from 'react';

interface AuthShellProps{
    children: ReactNode;
    aside?: ReactNode;
}

const AuthShell = ({ children, aside }: AuthShellProps) => (
    <main className='screen-view relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground'>
        <header className='relative z-10 flex h-[var(--app-header-height)] shrink-0 items-center justify-between px-6 sm:px-10 lg:px-24'>
            <span className='wordmark'>Quantum</span>
            {aside}
        </header>

        <div className='relative grid flex-1'>
            <div className='auth-stars pointer-events-none absolute inset-0' aria-hidden='true' />

            <section className='relative z-10 flex flex-col justify-center px-6 pb-24 pt-10 sm:px-10 lg:px-24'>
                <div className='w-full max-w-md'>{children}</div>
            </section>
        </div>

        <p className='label-caps absolute bottom-9 left-6 z-10 text-muted/70 sm:left-10 lg:left-24'>
            Self-hosted · Open source
        </p>
    </main>
);

export default AuthShell;
