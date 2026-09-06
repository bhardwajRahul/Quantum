import { config } from '@/shared/config';

export const publicHost = (): string => {
    try{
        return new URL(config.domain).hostname || 'localhost';
    }catch{
        return 'localhost';
    }
};
