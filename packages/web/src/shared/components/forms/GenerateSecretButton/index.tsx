import { Button } from '@heroui/react';
import { Dices } from 'lucide-react';
import { generateSecret } from '@/shared/utils/secret-variable';

interface GenerateSecretButtonProps{
    name: string;
    onGenerate: (value: string) => void;
    isDisabled?: boolean;
}

const GenerateSecretButton = ({ name, onGenerate, isDisabled = false }: GenerateSecretButtonProps) => (
    <Button
        isIconOnly
        variant='ghost'
        size='sm'
        className='size-7 text-muted hover:text-foreground'
        aria-label={`Generate ${name}`}
        isDisabled={isDisabled}
        onPress={() => onGenerate(generateSecret())}
    >
        <Dices aria-hidden='true' className='size-4' />
    </Button>
);

export default GenerateSecretButton;
