import { Button } from '@heroui/react';
import InlineError from '@/shared/components/InlineError';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { githubApi } from '@/modules/github/api/api';
import { githubErrorMessages } from '@/modules/github/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';

const copy = errorCopy(githubErrorMessages);

interface ConnectGithubButtonProps{
    label?: string;
}

/**
 * `/github/oauth/start` is Bearer-authenticated, so the browser cannot be pointed
 * straight at it: a top-level navigation carries no Authorization header, and the
 * route answers `Authentication::Unauthorized`. The URL is fetched through the
 * authenticated client, and only GitHub's own authorize URL is navigated to.
 *
 * Fetching it also means a server that has no OAuth app configured now says so —
 * a navigation could only ever have dumped raw JSON into the viewport.
 */
const ConnectGithubButton = ({ label = 'Connect GitHub' }: ConnectGithubButtonProps) => {
    const start = useMutation(githubApi.oauthStart, {
        onSuccess: ({ url }) => { window.location.href = url; }
    });

    return (
        <div className='flex flex-col items-start gap-2'>
            <Button isPending={start.loading} onPress={() => { void start.run().catch(() => undefined); }}>
                {label}
            </Button>

            {start.error !== undefined && <InlineError>{copy(start.error)}</InlineError>}
        </div>
    );
};

export default ConnectGithubButton;
