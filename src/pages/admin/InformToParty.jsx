import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BellRing, History, Save, X, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import SearchableDropdown from '../../components/SearchableDropdown';
import { useToast } from '../../contexts/ToastContext';

const ORDER_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;
const SHEET_ID = import.meta.env.VITE_orderToDispatch_SHEET_ID;

const InformToPartyBeforeDispatch = () => {
    const [pendingItems, setPendingItems] = useState([]);
    const [historyItems, setHistoryItems] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedRows, setSelectedRows] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [godownFilter, setGodownFilter] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const { showToast } = useToast();

    const abortControllerRef = useRef(null);
    const minLoadingTimeRef = useRef(null); // to ensure skeleton shows for at least 300ms

    const formatDisplayDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }).replace(/ /g, '-');
        } catch (e) {
            return dateStr;
        }
    };

    // --- Skeleton Components ---
    const TableSkeleton = ({ cols }) => (
        <>
            {[...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0 relative overflow-hidden">
                    {[...Array(cols)].map((_, j) => (
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

    const MobileSkeleton = () => (
        <div className="divide-y divide-gray-100">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 space-y-4 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2 w-2/3">
                            <div className="h-3 w-1/3 bg-gray-100 rounded-lg relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
                            </div>
                            <div className="h-5 w-full bg-gray-100 rounded-lg relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
                            </div>
                        </div>
                        <div className="h-6 w-12 bg-gray-100 rounded-lg relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="h-8 bg-gray-50 rounded-lg relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
                        </div>
                        <div className="h-8 bg-gray-50 rounded-lg relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    // --- Fetch function with minimum loading time and error handling ---
    const fetchInformToPartyData = useCallback(async (isRefresh = false) => {
        // Cancel any previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Clear any previous error
        setError(null);

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        // Minimum display time so the skeleton animation is clearly visible
        const MIN_DISPLAY_MS = 1500;
        const minTimer = new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_MS));

        const fetchData = async () => {
            const url = new URL(ORDER_URL);
            url.searchParams.set('sheet', 'Planning');
            url.searchParams.set('mode', 'table');
            if (SHEET_ID) url.searchParams.set('sheetId', SHEET_ID);

            const response = await fetch(url.toString(), { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();

            if (!result.success) throw new Error(result.error || 'Unknown error');

            const allItems = (result.data || []).slice(4).map((item, index) => ({
                id: `P${index}`,
                orderNo: item.orderNumber || '-',
                dispatchNo: item.dispatchNo || '-',
                clientName: item.clientName || '-',
                godownName: item.godownName || '-',
                itemName: item.itemName || '-',
                qty: item.qty || '-',
                dispatchQty: item.dispatchQty || '-',
                dispatchDate: item.dispatchDate || '-',
                columnK: item.columnK || '',
                columnL: item.columnL || ''
            }));

            const pending = allItems.filter(item =>
                item.columnK && item.columnK.toString().trim() !== '' &&
                (!item.columnL || item.columnL.toString().trim() === '')
            );

            const history = allItems.filter(item =>
                item.columnK && item.columnK.toString().trim() !== '' &&
                item.columnL && item.columnL.toString().trim() !== ''
            );

            return { pending, history };
        };

        try {
            // Wait for BOTH the data fetch AND the minimum display timer
            const [result] = await Promise.all([fetchData(), minTimer]);
            if (!controller.signal.aborted) {
                setPendingItems(result.pending);
                setHistoryItems(result.history);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('fetchInformToPartyData error:', error);
                setError(error.message);
                showToast('Error', 'Failed to load data: ' + error.message);
            }
        } finally {
            if (!controller.signal.aborted) {
                if (isRefresh) {
                    setRefreshing(false);
                } else {
                    setLoading(false);
                }
            }
        }
    }, [showToast]);



    // Initial load on mount
    useEffect(() => {
        fetchInformToPartyData();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchInformToPartyData]);

    // Refresh handler
    const handleRefresh = useCallback(() => {
        fetchInformToPartyData(true);
    }, [fetchInformToPartyData]);

    // Memoized Filter Options
    const allUniqueClients = useMemo(() =>
        [...new Set([...pendingItems.map(o => o.clientName), ...historyItems.map(h => h.clientName)])].sort(),
        [pendingItems, historyItems]
    );

    const allUniqueGodowns = useMemo(() =>
        [...new Set([...pendingItems.map(o => o.godownName), ...historyItems.map(h => h.godownName)])].sort(),
        [pendingItems, historyItems]
    );

    // Sorting logic
    const requestSort = useCallback((key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, []);

    const getSortedItems = useCallback((itemsToSort) => {
        if (!sortConfig.key) return itemsToSort;

        return [...itemsToSort].sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            const aNum = parseFloat(String(aVal).replace(/[^0-9.-]+/g, ''));
            const bNum = parseFloat(String(bVal).replace(/[^0-9.-]+/g, ''));
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
            }

            if (sortConfig.key.toLowerCase().includes('date')) {
                const aDate = new Date(aVal);
                const bDate = new Date(bVal);
                if (!isNaN(aDate) && !isNaN(bDate)) {
                    return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
                }
            }

            aVal = String(aVal || '').toLowerCase();
            bVal = String(bVal || '').toLowerCase();
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [sortConfig]);

    const filteredAndSortedPending = useMemo(() => {
        const filtered = pendingItems.filter(item => {
            const matchesSearch = Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesClient = clientFilter === '' || item.clientName === clientFilter;
            const matchesGodown = godownFilter === '' || item.godownName === godownFilter;
            return matchesSearch && matchesClient && matchesGodown;
        });
        return getSortedItems(filtered);
    }, [pendingItems, searchTerm, clientFilter, godownFilter, getSortedItems]);

    const filteredAndSortedHistory = useMemo(() => {
        const filtered = historyItems.filter(item => {
            const matchesSearch = Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesClient = clientFilter === '' || item.clientName === clientFilter;
            const matchesGodown = godownFilter === '' || item.godownName === godownFilter;
            return matchesSearch && matchesClient && matchesGodown;
        });
        return getSortedItems(filtered);
    }, [historyItems, searchTerm, clientFilter, godownFilter, getSortedItems]);

    const handleCheckboxToggle = (dn) => {
        setSelectedRows(prev => {
            const newSelected = { ...prev };
            if (newSelected[dn]) {
                delete newSelected[dn];
            } else {
                newSelected[dn] = 'yes';
            }
            return newSelected;
        });
    };

    const handleStatusChange = (dn, status) => {
        setSelectedRows(prev => ({ ...prev, [dn]: status }));
    };

    const handleSave = async () => {
        const rowsToSubmit = [];
        const selectedDNs = Object.keys(selectedRows);

        if (selectedDNs.length === 0) return;

        setIsSaving(true);
        const now = new Date().toISOString();

        selectedDNs.forEach(dn => {
            const item = pendingItems.find(i => i.dispatchNo === dn);
            if (!item) return;

            rowsToSubmit.push({
                timestamp: now,
                columnB: item.dispatchNo,
                columnC: selectedRows[dn] === 'yes' ? 'YES' : 'NO',
                columnD: item.clientName,
                columnE: item.godownName,
                columnF: item.itemName,
                columnG: item.qty,
                columnH: item.dispatchQty,
                dispatchNo: item.dispatchNo
            });
        });

        try {
            // Bypass CORS preflight by using text/plain
            const response = await fetch(ORDER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    sheetId: SHEET_ID,
                    sheet: "Before Dispatch",
                    rows: rowsToSubmit
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Unknown error');

            showToast('Confirmation saved to "Before Dispatch" sheet successfully!', 'success');

            // Clear selected rows and refresh data
            setSelectedRows({});
            await fetchInformToPartyData(true);
        } catch (error) {
            console.error('Submission failed:', error);
            showToast('Failed to submit confirmation. Please check console.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render ---
    return (
        <div className="relative">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6 bg-white p-4 lg:p-5 rounded shadow-sm border border-gray-100 max-w-[1200px] mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <h1 className="text-xl font-bold text-gray-800 tracking-tight whitespace-nowrap">Inform to Party (Before Dispatch)</h1>

                        <div className="flex bg-gray-100 p-1 rounded">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'
                                    }`}
                            >
                                <BellRing size={16} />
                                Pending
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'
                                    }`}
                            >
                                <History size={16} />
                                History
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters and Actions */}
                <div className="flex flex-col lg:flex-row justify-between gap-4 lg:items-start">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
                        <input
                            type="text"
                            placeholder="Search records..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm transition-all"
                        />
                        <div className="h-[42px]">
                            <SearchableDropdown
                                value={clientFilter}
                                onChange={setClientFilter}
                                options={allUniqueClients}
                                allLabel="All Clients"
                                className="w-full h-full"
                                focusColor="primary"
                            />
                        </div>
                        <div className="h-[42px]">
                            <SearchableDropdown
                                value={godownFilter}
                                onChange={setGodownFilter}
                                options={allUniqueGodowns}
                                allLabel="All Godowns"
                                className="w-full h-full"
                                focusColor="primary"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || isSaving}
                            className="flex items-center justify-center gap-1.5 px-4 h-[42px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-bold border border-gray-200 disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>

                        {(searchTerm || clientFilter || godownFilter) && (
                            <button
                                onClick={() => { setSearchTerm(''); setClientFilter(''); setGodownFilter(''); }}
                                className="flex items-center justify-center gap-1.5 px-4 h-[42px] bg-green-50 text-primary rounded hover:bg-green-100 transition-colors text-sm font-bold border border-green-100"
                            >
                                <X size={15} />
                                Clear
                            </button>
                        )}

                        {activeTab === 'pending' && Object.keys(selectedRows).length > 0 && (
                            <button
                                onClick={handleSave}
                                className="flex items-center justify-center gap-2 px-5 h-[42px] bg-primary text-white rounded hover:bg-primary-hover shadow-md font-bold text-sm ml-auto sm:ml-0 flex-1 sm:flex-none"
                            >
                                <Save size={16} />
                                Confirm Notification
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Global Progress Bar for background refreshes */}
            {refreshing && (
                <div className="fixed top-0 left-0 right-0 h-1 z-[101] overflow-hidden bg-gray-100">
                    <div className="h-full bg-primary animate-shimmer" style={{ width: '40%', backgroundSize: '200% 100%' }}></div>
                </div>
            )}

            {/* Saving overlay */}
            {isSaving && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/40 backdrop-blur-md transition-all duration-300">
                    <div className="bg-white/80 p-10 rounded-3xl shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] flex flex-col items-center gap-6 border border-white/50 relative overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500"></div>
                        <div className="relative">
                            <svg className="w-16 h-16 animate-spin" viewBox="0 0 50 50">
                                <circle className="opacity-20" cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--primary, #58cc02)' }} />
                                <circle className="opacity-100" cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" style={{ color: 'var(--primary, #58cc02)' }} />
                            </svg>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <h3 className="text-lg font-black text-gray-800 uppercase tracking-[0.3em] mb-1">Saving</h3>
                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider bg-gray-50 px-3 py-1 rounded-full border border-gray-100 shadow-inner">
                                Updating Records
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden max-w-[1200px] mx-auto">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 max-h-[460px] overflow-y-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold sticky top-0 z-10 shadow-sm">
                                {activeTab === 'pending' && <th className="px-6 py-4 text-center">Action</th>}
                                {[
                                    ...(activeTab === 'pending' ? [{ label: 'Order No', key: 'orderNo' }] : []),
                                    { label: 'Dispatch Number', key: 'dispatchNo', color: 'blue' },
                                    { label: 'Dispatch Qty', key: 'dispatchQty', align: 'right' },
                                    { label: 'Dispatch Date', key: 'dispatchDate', align: 'center' },
                                    { label: 'Client Name', key: 'clientName' },
                                    { label: 'Godown Name', key: 'godownName', align: 'center' },
                                    { label: 'Item Name', key: 'itemName' },
                                    { label: 'Qty', key: 'qty', align: 'right' },
                                    ...(activeTab === 'history' ? [{ label: 'Status', key: 'status', align: 'center' }] : [])
                                ].map((col) => (
                                    <th
                                        key={col.key}
                                        className={`px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors ${col.color === 'blue' ? 'text-primary' : ''} ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
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
                            {loading ? (
                                <TableSkeleton cols={activeTab === 'pending' ? 10 : 9} />
                            ) : error ? (
                                <tr>
                                    <td colSpan="14" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-red-50 rounded-full">
                                                <BellRing size={32} className="text-red-200" />
                                            </div>
                                            <p className="text-sm font-bold text-red-500 uppercase tracking-widest">Failed to load data</p>
                                            <button
                                                onClick={() => fetchInformToPartyData(false)}
                                                className="mt-2 px-4 py-2 bg-primary text-white rounded text-xs font-bold"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).length === 0 ? (
                                <tr>
                                    <td colSpan="14" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-gray-50 rounded-full">
                                                <BellRing size={32} className="text-gray-200" />
                                            </div>
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest italic">No items found matching your filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                (activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).map((item) => (
                                    <tr key={item.id} className={`${selectedRows[item.dispatchNo] ? 'bg-green-50/50' : 'hover:bg-gray-50'} transition-colors group`}>
                                        {activeTab === 'pending' && (
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!selectedRows[item.dispatchNo]}
                                                        onChange={() => handleCheckboxToggle(item.dispatchNo)}
                                                        className="rounded text-primary focus:ring-primary cursor-pointer w-4 h-4 shadow-sm"
                                                    />
                                                    {selectedRows[item.dispatchNo] && (
                                                        <select
                                                            value={selectedRows[item.dispatchNo]}
                                                            onChange={(e) => handleStatusChange(item.dispatchNo, e.target.value)}
                                                            className="text-[10px] font-black border border-green-200 rounded px-1.5 py-0.5 bg-green-50 text-primary outline-none focus:ring-1 focus:ring-primary animate-in fade-in zoom-in duration-200 shadow-sm"
                                                        >
                                                            <option value="yes">YES</option>
                                                            <option value="no">NO</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {activeTab === 'pending' && <td className="px-6 py-4 font-medium text-gray-500">{item.orderNo}</td>}
                                        <td className="px-6 py-4 font-bold text-primary">{item.dispatchNo}</td>
                                        <td className="px-6 py-4 font-black text-gray-800 text-right text-base">{item.dispatchQty}</td>
                                        <td className="px-6 py-4 font-black text-primary text-center text-[11px] uppercase tracking-tighter shadow-inner bg-slate-50/50 rounded-lg">{formatDisplayDate(item.dispatchDate)}</td>
                                        <td className="px-6 py-4 font-bold text-gray-800">{item.clientName}</td>
                                        <td className="px-6 py-4 text-center font-medium text-gray-600 truncate">{item.godownName}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-700">{item.itemName}</td>
                                        <td className="px-6 py-4 text-right font-black text-gray-400">{item.qty}</td>
                                        {activeTab === 'history' && (
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-700 shadow-sm">
                                                    Informed
                                                </span>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-200">
                    {loading ? (
                        <MobileSkeleton />
                    ) : error ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="p-4 bg-red-50 rounded-full">
                                <BellRing size={32} className="text-red-200" />
                            </div>
                            <p className="text-sm font-bold text-red-500 uppercase tracking-widest">Failed to load data</p>
                            <button
                                onClick={() => fetchInformToPartyData(false)}
                                className="mt-2 px-4 py-2 bg-primary text-white rounded text-xs font-bold"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="p-4 bg-gray-50 rounded-full">
                                <BellRing size={32} className="text-gray-200" />
                            </div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No items found matching your filters.</p>
                        </div>
                    ) : (
                        (activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).map((item) => (
                            <div key={item.id} className={`p-6 space-y-4 ${selectedRows[item.dispatchNo] ? 'bg-green-50/30' : 'bg-white'} hover:bg-slate-50 transition-colors`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4 items-start">
                                        {activeTab === 'pending' && (
                                            <div className="flex flex-col gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedRows[item.dispatchNo]}
                                                    onChange={() => handleCheckboxToggle(item.dispatchNo)}
                                                    className="mt-1 rounded text-primary focus:ring-primary w-6 h-6 cursor-pointer border-2 border-slate-200 shadow-sm"
                                                />
                                                {selectedRows[item.dispatchNo] && (
                                                    <select
                                                        value={selectedRows[item.dispatchNo]}
                                                        onChange={(e) => handleStatusChange(item.dispatchNo, e.target.value)}
                                                        className="text-[10px] font-black border border-green-200 rounded px-2 py-1 bg-green-50 text-primary outline-none animate-in fade-in slide-in-from-left-2 duration-300 shadow-md"
                                                    >
                                                        <option value="yes">YES</option>
                                                        <option value="no">NO</option>
                                                    </select>
                                                )}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">{item.dispatchNo}</p>
                                            <h4 className="text-lg font-black text-gray-900 leading-tight">{item.clientName}</h4>
                                            <p className="text-[10px] mt-2 font-bold text-gray-400 uppercase tracking-widest">{item.itemName}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {activeTab === 'history' && (
                                            <span className="block mb-2 px-3 py-1 rounded shadow-sm text-[10px] font-black uppercase tracking-tighter bg-green-100 text-green-700">
                                                Informed
                                            </span>
                                        )}
                                        <div className="text-right">
                                            <span className="block text-2xl font-black text-gray-900 leading-none">{item.dispatchQty}</span>
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Disp Qty</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[11px] bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em]">Disp Date</span>
                                        <span className="font-bold text-primary">{formatDisplayDate(item.dispatchDate)}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 text-right">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em]">Order No</span>
                                        <span className="font-bold text-gray-700">{item.orderNo}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em]">Godown</span>
                                        <span className="font-bold text-gray-700 truncate">{item.godownName}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 text-right">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em]">Total Qty</span>
                                        <span className="font-bold text-gray-400 italic">{item.qty}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default InformToPartyBeforeDispatch;