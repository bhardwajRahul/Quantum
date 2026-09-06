import { useState } from 'react';
import { Button, Input, TextField } from '@heroui/react';
import { ArrowRight, HardDrive, Plus, Trash2 } from 'lucide-react';
import SettingsSection from '@/shared/components/SettingsSection';
import InlineError from '@/shared/components/InlineError';
import { useMutation } from '@/shared/hooks/api/use-mutation';
import { repositoryApi } from '@/modules/repository/api/api';
import { repositoryErrorMessages } from '@/modules/repository/utils/error-messages';
import { errorCopy } from '@/shared/utils/error-copy';
import type { Repository } from '@quantum/contracts/modules/repository/domain';

const copy = errorCopy(repositoryErrorMessages);

const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3';

const cleaned = (paths: string[]): string[] => paths.map((path) => path.trim()).filter((path) => path !== '');

const sameList = (a: string[], b: string[]): boolean => a.length === b.length && a.every((value, index) => value === b[index]);

interface PersistentVolumesProps{
    repository: Repository;
    onSaved: () => void;
}

const PersistentVolumes = ({ repository, onSaved }: PersistentVolumesProps) => {
    const [paths, setPaths] = useState<string[]>(repository.volumes);
    const update = useMutation((volumes: string[]) => repositoryApi.update({ path: { id: repository.id }, body: { volumes } }));

    const dirty = !sameList(cleaned(paths), repository.volumes);

    const save = async () => {
        const saved = await update.run(cleaned(paths)).then(() => true, () => false);
        if(saved) onSaved();
    };

    return (
        <SettingsSection
            title='Persistent volumes'
            description='Paths inside the container whose contents survive deploys and restarts. The checkout at /app already does.'
        >
            <div className='flex flex-col gap-3'>
                {paths.length === 0 && (
                    <p className='flex items-center gap-2 text-[0.8125rem] text-muted'>
                        <HardDrive aria-hidden='true' className='size-4' />
                        Nothing outside /app is kept between deploys yet.
                    </p>
                )}

                {paths.map((path, index) => (
                    <div key={index} className={ROW_GRID}>
                        <TextField
                            aria-label='Container path'
                            value={path}
                            onChange={(value) => setPaths((current) => current.map((entry, position) => (position === index ? value : entry)))}
                            validationBehavior='aria'
                            fullWidth
                        >
                            <Input className='font-mono' placeholder='/var/lib/app/uploads' autoComplete='off' />
                        </TextField>

                        <Button
                            isIconOnly
                            variant='ghost'
                            className='text-muted hover:text-foreground'
                            aria-label={path === '' ? 'Remove volume' : `Remove ${path}`}
                            onPress={() => setPaths((current) => current.filter((_, position) => position !== index))}
                        >
                            <Trash2 aria-hidden='true' className='size-4' />
                        </Button>
                    </div>
                ))}

                {update.error !== undefined && <InlineError>{copy(update.error)}</InlineError>}

                <div className='flex flex-wrap items-center gap-2'>
                    <Button variant='secondary' onPress={() => setPaths((current) => (current.includes('') ? current : [...current, '']))}>
                        <Plus aria-hidden='true' className='size-4' />
                        Add path
                    </Button>
                    <Button isPending={update.loading} isDisabled={!dirty} onPress={() => { void save(); }}>
                        Save and redeploy
                        <ArrowRight aria-hidden='true' className='size-4' />
                    </Button>
                </div>
            </div>
        </SettingsSection>
    );
};

export default PersistentVolumes;
