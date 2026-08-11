import { Button } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageNavigation } from '@/shared/utils/pagination';
import type { PageMeta } from '@quantum/contracts/shared/http';

interface PagerProps{
    meta: PageMeta;
    isPending: boolean;
    onChange: (offset: number) => void;
}

const Pager = ({ meta, isPending, onChange }: PagerProps) => {
    const navigation = pageNavigation(meta);

    if(navigation.pageCount <= 1) return null;

    return (
        <div className='flex items-center justify-between gap-4'>
            <span className='text-[0.8125rem] tabular-nums text-muted'>
                {navigation.from}–{navigation.to} of {meta.total}
            </span>

            <div className='flex items-center gap-1'>
                <Button
                    isIconOnly
                    size='sm'
                    variant='ghost'
                    aria-label='Previous page'
                    isDisabled={!navigation.hasPrevious || isPending}
                    onPress={() => onChange(Math.max(0, meta.offset - meta.limit))}
                >
                    <ChevronLeft className='size-4' />
                </Button>

                <Button
                    isIconOnly
                    size='sm'
                    variant='ghost'
                    aria-label='Next page'
                    isDisabled={!navigation.hasNext || isPending}
                    onPress={() => onChange(meta.offset + meta.limit)}
                >
                    <ChevronRight className='size-4' />
                </Button>
            </div>
        </div>
    );
};

export default Pager;
