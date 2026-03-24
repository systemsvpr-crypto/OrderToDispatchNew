import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SheetsContext = createContext();

export const useSheets = () => {
    const context = useContext(SheetsContext);
    if (!context) {
        throw new Error('useSheets must be used within a SheetsProvider');
    }
    return context;
};

const API_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;
const SHEET_ID = import.meta.env.VITE_orderToDispatch_SHEET_ID;
const CACHE_KEY = 'globalSheetsData';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const SheetsProvider = ({ children }) => {
    const [data, setData] = useState({
        orders: [],
        planning: [],
        clients: [],
        itemNames: [],
        salesVendors: [],
        dispatchCompleted: [],
        afterDispatch: [],
        godowns: [],
        skip: [],
        pcReport: [],
        users: [],
        lastUpdated: null
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadFromCache = useCallback(() => {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const age = Date.now() - parsed.timestamp;
                if (age < CACHE_DURATION) {
                    setData(parsed.data);
                    return true;
                }
            } catch (e) {
                console.error('Failed to parse Sheets cache', e);
            }
        }
        return false;
    }, []);

    const saveToCache = useCallback((newData) => {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            data: newData,
            timestamp: Date.now()
        }));
    }, []);

    const refreshAll = useCallback(async (force = false) => {
        if (!force && loadFromCache()) return;

        setIsLoading(true);
        setError(null);
        try {
            console.log('[SheetsContext] Refreshing all data...');

            // Fetch in parallel
            const [
                ordersRes, 
                planningRes, 
                clientsRes, 
                productsRes, 
                vendorsRes,
                dispatchCompletedRes,
                afterDispatchRes,
                godownsRes,
                skipRes,
                pcReportRes,
                usersRes
            ] = await Promise.all([
                fetch(`${API_URL}?sheet=ORDER&mode=table&limit=1000&sheetId=${SHEET_ID}`),
                fetch(`${API_URL}?sheet=Planning&mode=table&limit=1000&sheetId=${SHEET_ID}`),
                fetch(`${API_URL}?sheet=Purchase%20Vendor&mode=col&col=1&sheetId=1ewO_3413za_gEguwM-Bs733bUCnUSirmDbwgbtfvTp8`),
                fetch(`https://script.google.com/macros/s/AKfycbzsybGNsW1jRz8MqT-971WLNFRJXgGEE9_QZDOCt3x4Y2snuRFxl_RQXD4HEO8ozMIn4g/exec?sheet=Products&mode=col&col=1`),
                fetch(`${API_URL}?sheet=SalesVendor&mode=col&col=0&sheetId=${SHEET_ID}`),
                fetch(`${API_URL}?sheet=Dispatch%20Completed&mode=table&limit=1000&sheetId=${SHEET_ID}`),
                fetch(`${API_URL}?sheet=After%20Dispatch&mode=table&limit=1000&sheetId=${SHEET_ID}`),
                fetch(`https://script.google.com/macros/s/AKfycbzsybGNsW1jRz8MqT-971WLNFRJXgGEE9_QZDOCt3x4Y2snuRFxl_RQXD4HEO8ozMIn4g/exec?sheet=Products&mode=col&col=8`),
                fetch(`${API_URL}?sheet=Skip&mode=table&limit=1000&sheetId=${SHEET_ID}`),
                fetch(`${API_URL}?sheet=PC%20Report&mode=table&limit=1000&sheetId=${SHEET_ID}`),
                fetch(`${API_URL}?sheet=Login&mode=table&sheetId=${SHEET_ID}`)
            ]);

            const [
                ordersJson, 
                planningJson, 
                clientsJson, 
                productsJson, 
                vendorsJson,
                dispatchCompletedJson,
                afterDispatchJson,
                godownsJson, 
                skipJson, 
                pcReportJson,
                usersJson
            ] = await Promise.all([
                ordersRes.json(),
                planningRes.json(),
                clientsRes.json(),
                productsRes.json(),
                vendorsRes.json(),
                dispatchCompletedRes.json().catch(() => ({ success: false })),
                afterDispatchRes.json().catch(() => ({ success: false })),
                godownsRes.json(),
                skipRes.json().catch(() => ({ success: false })),
                pcReportRes.json().catch(() => ({ success: false })),
                usersRes.json().catch(() => ({ success: false }))
            ]);

            const newData = {
                orders: ordersJson.success ? ordersJson.data : [],
                planning: planningJson.success ? planningJson.data : [],
                clients: clientsJson.success ? clientsJson.data : [],
                itemNames: productsJson.success ? productsJson.data : [],
                salesVendors: vendorsJson.success ? vendorsJson.data : [],
                dispatchCompleted: dispatchCompletedJson.success ? dispatchCompletedJson.data : [],
                afterDispatch: afterDispatchJson.success ? afterDispatchJson.data : [],
                godowns: godownsJson.success ? godownsJson.data : [],
                skip: skipJson.success ? skipJson.data : [],
                pcReport: pcReportJson.success ? pcReportJson.data : [],
                users: usersJson.success ? usersJson.data : [],
                lastUpdated: new Date().toISOString()
            };

            setData(newData);
            saveToCache(newData);
        } catch (err) {
            console.error('[SheetsContext] Fetch Error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [loadFromCache, saveToCache]);

    // Initial load on mount if not cached
    useEffect(() => {
        loadFromCache();
    }, [loadFromCache]);

    const value = {
        ...data,
        isLoading,
        error,
        refreshAll,
        setData // For manual updates
    };

    return (
        <SheetsContext.Provider value={value}>
            {children}
        </SheetsContext.Provider>
    );
};
