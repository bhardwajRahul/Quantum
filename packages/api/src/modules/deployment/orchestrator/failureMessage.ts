const MAX_LENGTH = 500;

export const failureMessage = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : String(error);
    const message = raw.replace(/\s+/g, ' ').trim();
    if(message === '') return 'The deployment failed without reporting a reason.';

    return message.length > MAX_LENGTH ? `${message.slice(0, MAX_LENGTH - 1)}…` : message;
};
