import baseSlugify from 'slugify';

export const slug = (value: string): string =>
    baseSlugify(value, { lower: true, strict: true });
