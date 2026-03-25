import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';

const POLLING_INTERVAL = 20000; // 20 seconds

export function useDataSync(sheetName, fetchDataFn, cacheKey, cacheDuration = 10 * 60 * 1000) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);   // Final overlay trigger
    const [refreshing, setRefreshing] = useState(false); // Manual refresh spinner
    const { showToast } = useToast();

    const intervalRef = useRef(null);
    const abortControllerRef = useRef(null);
    // We store the LAST SERVER MODIFIED timestamp we successfully fetched
    const lastModifiedRef = useRef(null);
    const fetchDataFnRef = useRef(fetchDataFn);

    // Keep the fetcher function ref up-to-date
    useEffect(() => {
        fetchDataFnRef.current = fetchDataFn;
    }, [fetchDataFn]);

    const API_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;

    // Manual or Background Fetcher
    const executeFetch = useCallback(async (serverTs = null, signal = null) => {
        try {
            const freshData = await fetchDataFnRef.current(signal);
            setData(freshData);

            // Update our reference and storage with the NEW server timestamp
            // If we don't have a serverTs (manual refresh), we'll catch up on the next poll
            if (serverTs) {
                lastModifiedRef.current = serverTs;
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    data: freshData,
                    timestamp: serverTs
                }));
            }
            return freshData;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn(`Sync fetch failed for ${sheetName}:`, err.message);
                throw err;
            }
        }
    }, [sheetName, cacheKey]);

    useEffect(() => {
        // --- Initial Cache Check ---
        const cachedStr = sessionStorage.getItem(cacheKey);
        if (cachedStr) {
            try {
                const parsed = JSON.parse(cachedStr);
                if (parsed.data && parsed.timestamp) {
                    setData(parsed.data);
                    lastModifiedRef.current = parsed.timestamp;
                    setLoading(false);
                    // Special case: if cache is very old (> cacheDuration), don't trust it fully
                    // but show it anyway for immediate UI, then sync will fix it.
                    console.log(`[useDataSync] Loaded ${sheetName} from cache. Last Server Modified: ${parsed.timestamp}`);
                }
            } catch (e) { /* ignore */ }
        }

        const checkAndSync = async () => {
            try {
                const res = await fetch(`${API_URL}?action=lastModified&sheet=${sheetName}`);
                const json = await res.json();

                if (json.success) {
                    const serverTimestamp = parseInt(json.lastModified, 10);
                    const needsUpdate = !lastModifiedRef.current || serverTimestamp > lastModifiedRef.current;

                    if (needsUpdate) {
                        console.log(`[useDataSync] ${sheetName} update detected: ${lastModifiedRef.current || 0} -> ${serverTimestamp}`);
                        if (abortControllerRef.current) abortControllerRef.current.abort();
                        const controller = new AbortController();
                        abortControllerRef.current = controller;

                        await executeFetch(serverTimestamp, controller.signal);
                    }
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn(`[useDataSync] lastModified check failed for ${sheetName}:`, err.message);
                    // If we have no data at all, force a fetch
                    if (!lastModifiedRef.current) await executeFetch(null);
                }
            } finally {
                setLoading(false);
            }
        };

        // First check
        checkAndSync();

        // Setup background interval
        intervalRef.current = setInterval(checkAndSync, POLLING_INTERVAL);

        return () => {
            clearInterval(intervalRef.current);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [sheetName, cacheKey, API_URL, executeFetch]);

    // Public manual refresh method (silently spins the refresh button)
    const refresh = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setRefreshing(true);
        try {
            // Manual refresh might not have a serverTs, so we set it to null 
            // and let the next polling cycle update lastModifiedRef correctly.
            await executeFetch(null, controller.signal);
            showToast(`Successfully refreshed ${sheetName}`, 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                showToast(`Failed to refresh ${sheetName} data`, 'error');
            }
        } finally {
            setRefreshing(false);
        }
    }, [executeFetch, sheetName, showToast]);

    return { data, loading, refreshing, refresh };
}