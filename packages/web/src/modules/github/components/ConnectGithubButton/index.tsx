import { Button } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import InlineError from '@/shared/components/InlineError';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { githubApi } from '@/modules/github/api/api';
import { githubErrorMessages } from '@/modules/github/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';

const copy = errorCopy(githubErrorMessages);

interface ConnectGithubButtonProps{
    label?: string;
}

const ConnectGithubButton = ({ label = 'Connect GitHub' }: ConnectGithubButtonProps) => {
    const start = useMutation(githubApi.oauthStart, {
        onSuccess: ({ url }) => { window.location.href = url; }
    });

    return (
        <div className='flex flex-col items-start gap-2'>
            <Button isPending={start.loading} onPress={() => { void start.run().catch(() => undefined); }}>
                {label}
                <ArrowRight aria-hidden='true' className='size-4' />
            </Button>

            {start.error !== undefined && <InlineError>{copy(start.error)}</InlineError>}
        </div>
    );
};

export default ConnectGithubButton;
