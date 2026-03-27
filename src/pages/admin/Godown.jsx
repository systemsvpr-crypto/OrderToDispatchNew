import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Filter, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

// --- Skeleton for table rows ---
const TableSkeleton = () => (
  <>
    {[...Array(7)].map((_, i) => (
      <tr key={i} className="border-b border-gray-100 last:border-0">
        {[...Array(9)].map((_, j) => (
          <td key={j} className="px-6 py-4">
            <div className="h-4 bg-gray-100 rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
            </div>
          </td>
        ))}
      </tr>
    ))}
  </>
);

const Godown = () => {
    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [godownFilter, setGodownFilter] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const abortControllerRef = useRef(null);
    const { showToast } = useToast();

    const godownTabs = ['All', 'darba', 'DP', 'dusera', 'godown'];

    const API_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;
    const SHEET_ID = import.meta.env.VITE_orderToDispatch_SHEET_ID;

    // Helper to get value from object regardless of key casing/spaces
    const getVal = (obj, ...possibleKeys) => {
        if (!obj) return undefined;
        const keys = Object.keys(obj);
        for (const pKey of possibleKeys) {
            if (obj[pKey] !== undefined) return obj[pKey];
            const normalizedPKey = pKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            const foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedPKey);
            if (foundKey) return obj[foundKey];
        }
        return undefined;
    };

    const formatDisplayDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const day = date.getDate().toString().padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[date.getMonth()];
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch { return dateStr; }
    };

    // Fetch Planning data
    const fetchPlanning = useCallback(async (isRefresh = false) => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        if (isRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        const MIN_DISPLAY_MS = 1500;
        const minTimer = new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_MS));

        const doFetch = async () => {
            const url = new URL(API_URL);
            url.searchParams.set('sheet', 'Planning');
            url.searchParams.set('mode', 'table');
            if (SHEET_ID) url.searchParams.set('sheetId', SHEET_ID);

            const response = await fetch(url.toString(), { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                return result.data.slice(3).map((item, idx) => ({
                    originalIndex: idx,
                    dispatchNo: getVal(item, 'dispatchNo', 'Dispatch No') || '-',
                    dispatchDate: getVal(item, 'dispatchDate', 'Dispatch Date') || '-',
                    orderNo: getVal(item, 'orderNumber', 'Order No', 'Order Number') || '-',
                    customerName: getVal(item, 'clientName', 'Customer', 'Customer Name') || '-',
                    productName: getVal(item, 'itemName', 'Product', 'Product Name') || '-',
                    orderQty: getVal(item, 'qty', 'Order Qty') || '0',
                    dispatchQty: getVal(item, 'dispatchQty', 'Dispatch Qty') || '0',
                    godown: getVal(item, 'godownName', 'Godown') || '-',
                    gstIncluded: getVal(item, 'gstIncluded', 'GST Included') || '-'
                }));
            }
            return [];
        };

        try {
            const [mapped] = await Promise.all([doFetch(), minTimer]);
            if (!controller.signal.aborted) setItems(mapped);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching planning data:', error);
                showToast('Error', 'Failed to load warehouse data: ' + error.message);
            }
        } finally {
            if (!controller.signal.aborted) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [API_URL, SHEET_ID, showToast]);

    // Initial load on mount
    useEffect(() => {
        fetchPlanning();
        return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
    }, [fetchPlanning]);

    // Manual Refresh
    const handleRefresh = useCallback(() => fetchPlanning(true), [fetchPlanning]);

    // Sorting logic
    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortedItems = useCallback((itemsToSort) => {
        if (!sortConfig.key) return itemsToSort;
        return [...itemsToSort].sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            const aNum = parseFloat(String(aVal).replace(/[^0-9.-]+/g, ''));
            const bNum = parseFloat(String(bVal).replace(/[^0-9.-]+/g, ''));
            if (!isNaN(aNum) && !isNaN(bNum)) return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
            if (sortConfig.key.toLowerCase().includes('date')) {
                const aD = new Date(aVal), bD = new Date(bVal);
                if (!isNaN(aD) && !isNaN(bD)) return sortConfig.direction === 'asc' ? aD - bD : bD - aD;
            }
            aVal = String(aVal || '').toLowerCase();
            bVal = String(bVal || '').toLowerCase();
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [sortConfig]);

    const filteredAndSortedItems = useMemo(() => {
        const filtered = items.filter(item => {
            const matchesSearch = !searchTerm || Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase().trim())
            );
            const itemGodown = (item.godown || '').trim().toLowerCase();
            const selectedGodown = godownFilter.trim().toLowerCase();
            const matchesGodown = godownFilter === 'All' || itemGodown === selectedGodown;
            return matchesSearch && matchesGodown;
        });
        return getSortedItems(filtered);
    }, [items, searchTerm, godownFilter, getSortedItems]);

    const tabCounts = useMemo(() => godownTabs.reduce((acc, tab) => {
        if (tab === 'All') acc[tab] = items.length;
        else acc[tab] = items.filter(item => (item.godown || '').trim().toLowerCase() === tab.toLowerCase()).length;
        return acc;
    }, {}), [items]);

    return (
        <div className="">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 bg-white p-4 rounded shadow-sm border border-white/50 max-w-[1200px] mx-auto">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded text-primary"><Filter size={20} /></div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Godown Management</h1>
                        <p className="text-xs text-gray-500">Filter and view dispatch data by warehouse</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs font-bold border border-gray-200 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded focus:ring-primary focus:border-primary"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-2 max-w-[1200px] mx-auto">
                {godownTabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setGodownFilter(tab)}
                        className={`px-5 py-2 rounded text-sm font-semibold border transition-all ${godownFilter === tab ? 'bg-primary text-white border-primary shadow-md transform scale-105' : 'bg-white text-gray-600 border-gray-200 hover:bg-green-50'
                            }`}
                    >
                        {tab === 'All' ? 'All Warehouses' : <span className="capitalize">{tab}</span>}
                        <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] ${godownFilter === tab ? 'bg-white/20' : 'bg-gray-100'}`}>
                            {tabCounts[tab] || 0}
                        </span>
                    </button>
                ))}
            </div>

            <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden max-w-[1200px] mx-auto">
                <div className="overflow-x-auto scrollbar-thin max-h-[500px]">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold sticky top-0 z-10">
                                {[
                                    { label: 'Dispatch No', key: 'dispatchNo' },
                                    { label: 'Dispatch Date', key: 'dispatchDate', align: 'center' },
                                    { label: 'Order No', key: 'orderNo' },
                                    { label: 'Customer', key: 'customerName' },
                                    { label: 'Product', key: 'productName' },
                                    { label: 'Order Qty', key: 'orderQty', align: 'right' },
                                    { label: 'Dispatch Qty', key: 'dispatchQty', align: 'right' },
                                    { label: 'Godown', key: 'godown', align: 'center' },
                                    { label: 'GST', key: 'gstIncluded', align: 'center' }
                                ].map((col) => (
                                    <th
                                        key={col.key}
                                        className={`px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                                        onClick={() => requestSort(col.key)}
                                    >
                                        <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                                            {col.label}
                                            <div className="flex flex-col">
                                                <ChevronUp size={10} className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'text-primary' : 'text-gray-300'} />
                                                <ChevronDown size={10} className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'text-primary' : 'text-gray-300'} />
                                            </div>
                                        </div>
                                    </th>
                                ))}
                             </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm">
                            {isLoading ? (
                                <TableSkeleton />
                            ) : filteredAndSortedItems.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-4 py-20 text-center text-gray-400 italic font-bold text-sm">No entries found for this selection.</td>
                                </tr>
                            ) : null}
                            {!isLoading && filteredAndSortedItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-semibold text-gray-900">{item.dispatchNo}</td>
                                    <td className="px-6 py-4 text-gray-600 text-xs text-center">{formatDisplayDate(item.dispatchDate)}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.orderNo}</td>
                                    <td className="px-6 py-4 font-medium text-gray-800">{item.customerName}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.productName}</td>
                                    <td className="px-6 py-4 text-gray-600 text-right">{item.orderQty}</td>
                                    <td className="px-6 py-4 text-gray-600 font-bold text-primary text-right">{item.dispatchQty}</td>
                                    <td className="px-6 py-4 text-gray-600 capitalize text-center">{item.godown}</td>
                                    <td className="px-6 py-4 text-gray-600 text-center">{item.gstIncluded}</td>
                                </tr>
                            ))}
                            {filteredAndSortedItems.length === 0 && !isLoading && (
                                <tr><td colSpan="9" className="px-4 py-20 text-center text-gray-500 italic">No entries found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Refresh progress bar */}
            {isRefreshing && (
                <div className="fixed top-0 left-0 right-0 h-1 z-[101] bg-gray-100 overflow-hidden">
                    <div className="h-full bg-primary animate-shimmer-fast" style={{ width: '40%' }}></div>
                </div>
            )}
        </div>
    );
};

export default Godown;