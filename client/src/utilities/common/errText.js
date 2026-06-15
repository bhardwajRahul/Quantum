/** Extract a display message from an error: the string itself, its .message, or a fallback. */
export const errText = (err, fallback) =>
    typeof err === 'string' ? err : (err?.message || fallback);
