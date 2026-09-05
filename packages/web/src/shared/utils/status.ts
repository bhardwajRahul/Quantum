import type { ChipVariants } from '@heroui/react';

export type StatusColor = NonNullable<ChipVariants['color']>;

export interface StatusMeta<C>{
    label: string;
    color: C;
}

export const makeStatusMeta = <S extends string, C>(copy: Record<S, StatusMeta<C>>, transient: readonly S[] = []) => ({
    label: (status: S): string => copy[status].label,
    color: (status: S): C => copy[status].color,
    isTransient: (status: S): boolean => transient.includes(status)
});
