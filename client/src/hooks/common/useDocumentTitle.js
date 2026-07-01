import { useEffect, useRef } from 'react';

const useDocumentTitle = (title) => {
    const defaultTitle = useRef(document.title);
    const suffix = 'Quantum Cloud';

    useEffect(() => {
        const newTitle = `${title} - ${suffix}`;
        if(document.title !== newTitle) {
            document.title = newTitle;
        }
        return () => {
            document.title = defaultTitle.current;
        }
    }, [title]);
};

export default useDocumentTitle;