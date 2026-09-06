import type { GithubErrorCode } from '@quantum/contracts/modules/github/errors';

export const githubErrorMessages: Partial<Record<GithubErrorCode, string>> = {
    'Github::NotConfigured': 'GitHub integration is not configured on this server.',
    'Github::NotConnected': 'Your GitHub account is not connected yet.',
    'Github::ExchangeFailed': 'We could not complete the connection with GitHub.',
    'Github::AccountNotFound': 'That GitHub account no longer exists.',
    'Github::StateMismatch': 'That GitHub connection request expired. Please try again.'
};
