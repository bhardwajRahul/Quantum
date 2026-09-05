const MAX_LENGTH = 500;

/**
 * The text a deployment carries to explain why it failed. Docker's own messages are the
 * most useful thing available here — they name the missing network, the port already
 * taken, the image that would not pull — so they are passed through rather than replaced
 * with a generic string, and only clipped to what the column holds.
 */
export const failureMessage = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : String(error);
    const message = raw.replace(/\s+/g, ' ').trim();
    if(message === '') return 'The deployment failed without reporting a reason.';

    return message.length > MAX_LENGTH ? `${message.slice(0, MAX_LENGTH - 1)}…` : message;
};
