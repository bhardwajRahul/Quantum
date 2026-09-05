import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';

export const isUniqueViolation = (error: unknown): error is QueryFailedError =>
    error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION;

export const saveOrConflict = async <T>(promise: Promise<T>, conflict: () => Error): Promise<T> => {
    try{
        return await promise;
    }catch(error){
        if(isUniqueViolation(error)) throw conflict();
        throw error;
    }
};
