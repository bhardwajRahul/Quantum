export const notFound = (noun: string, determiner: 'That' | 'This' = 'That'): string =>
    `${determiner} ${noun} no longer exists.`;

export const forbidden = (noun: string, determiner: 'that' | 'this' = 'that'): string =>
    `You do not have access to ${determiner} ${noun}.`;
