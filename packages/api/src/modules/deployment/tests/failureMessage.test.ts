import { describe, expect, it } from 'vitest';
import { failureMessage } from '@/modules/deployment/orchestrator/failureMessage';

describe('failureMessage', () => {
    it('keeps what Docker actually said, which is the useful part', () => {
        const error = new Error('(HTTP code 404) no such container - failed to set up container networking: network quantum-network-1 not found ');

        expect(failureMessage(error)).toBe(
            '(HTTP code 404) no such container - failed to set up container networking: network quantum-network-1 not found'
        );
    });

    it('collapses the whitespace a multi-line stack message brings along', () => {
        expect(failureMessage(new Error('pull failed:\n   manifest unknown\n'))).toBe('pull failed: manifest unknown');
    });

    it('clips to what the column holds', () => {
        const message = failureMessage(new Error('x'.repeat(900)));

        expect(message).toHaveLength(500);
        expect(message.endsWith('…')).toBe(true);
    });

    it('still says something when the failure carried no message', () => {
        expect(failureMessage(new Error(''))).toBe('The deployment failed without reporting a reason.');
    });
});
