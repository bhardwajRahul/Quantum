export const errText = (err, fallback) =>
    typeof err === 'string' ? err : (err?.message || fallback);
