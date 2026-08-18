import { useCallback, useState } from 'react';
import { errText } from '@utilities/common/errText';

const useAsyncAction = ({ fallback, onError } = {}) => {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);

    const run = useCallback(async (action) => {
        setPending(true);
        setError(null);
        try{
            await action();
            return true;
        }catch(err){
            const message = errText(err, fallback);
            if(onError){
                onError(message, err);
            }else{
                setError(message);
            }
            return false;
        }finally{
            setPending(false);
        }
    }, [fallback, onError]);

    return { run, pending, error, clearError: () => setError(null) };
};

export default useAsyncAction;
