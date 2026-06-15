import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * Shared implementation for the paged "list of the current user's <resource>"
 * hooks. Each hook differs only in which slice it reads, which thunk fetches a
 * page, which setState action clears the list on unmount, and the field names it
 * exposes — so they are expressed as config here instead of four copies.
 *
 * NOTE: `cleanupPath` is passed through verbatim and intentionally may differ
 * from `dataKey` (e.g. data 'dockerContainers' but cleanup path 'containers').
 * That mismatch is pre-existing behavior; this factory preserves it exactly
 * rather than "fixing" it — changing it would be a behavior change, not a cleanup.
 *
 * @param {object} cfg
 * @param {string} cfg.slice        - key into the redux store (e.g. 'dockerImage').
 * @param {string} cfg.dataKey      - field holding the list (e.g. 'dockerImages').
 * @param {Function} cfg.operation  - thunk action creator fetching a page.
 * @param {Function} cfg.setState   - slice setState action creator (for cleanup).
 * @param {string} cfg.cleanupPath  - slice path reset to [] on unmount.
 * @param {*} [cfg.initialPage]     - initial page value; pass undefined to match
 *                                    useState() (portBinding), 1 for the others.
 *                                    Passed through verbatim (NO default coercion).
 * @param {string[]} [cfg.extraKeys=[]] - extra slice fields to expose (e.g. 'portBindingStats').
 */
const useUserResource = ({ slice, dataKey, operation, setState, cleanupPath, initialPage, extraKeys = [] }) => {
    const dispatch = useDispatch();
    const [page, setPage] = useState(initialPage);
    const sliceState = useSelector((state) => state[slice]);

    useEffect(() => {
        dispatch(operation({ page }));
    }, [page]);

    useEffect(() => {
        return () => {
            dispatch(setState({ path: cleanupPath, value: [] }));
        };
    }, []);

    const { isLoading, error, stats, isOperationLoading } = sliceState;
    const result = { [dataKey]: sliceState[dataKey], isLoading, error, stats, isOperationLoading, page, setPage };
    for(const key of extraKeys) result[key] = sliceState[key];
    return result;
};

export default useUserResource;
