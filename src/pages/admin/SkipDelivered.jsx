import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, Loader, X, Clock, History, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import SearchableDropdown from '../../components/SearchableDropdown';
import { useToast } from '../../contexts/ToastContext';
import { useSheets } from '../../contexts/SheetsContext';

const CACHE_KEY = 'skipDeliveredData';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Helper to get value from object regardless of key casing/spaces
const getVal = (obj, ...possibleKeys) => {
    if (!obj) return undefined;
    const keys = Object.keys(obj);
    for (const pKey of possibleKeys) {
        if (obj[pKey] !== undefined) return obj[pKey];
        if (typeof pKey !== 'string') continue;
        const normalizedPKey = pKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        const foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedPKey);
        if (foundKey) return obj[foundKey];
    }
    return undefined;
};

// Date Formatter for Display (e.g., 25-Feb-2026)
const formatDisplayDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const day = date.getDate().toString().padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
    } catch {
        return dateStr;
    }
};

// Formatter for <input type="date" />
const formatDateForInput = (dateStr) => {
    if (!dateStr || dateStr === '-') return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    } catch {
        return '';
    }
};

const SkipDelivered = () => {
    const { 
        orders: rawOrders, 
        skip: rawSkip, 
        godowns: contextGodowns, 
        isLoading, 
        refreshAll 
    } = useSheets();

    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedRows, setSelectedRows] = useState({});
    const [editData, setEditData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [godownFilter, setGodownFilter] = useState('');
    const { showToast } = useToast();

    const API_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;
    const SHEET_ID = import.meta.env.VITE_orderToDispatch_SHEET_ID;

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // --- Derive data from context ---
    const pendingItems = useMemo(() => {
        return rawOrders.slice(5).filter(item => {
            const qVal = String(item.columnQ || '').trim();
            const rVal = String(item.columnR || '').trim();
            const pendingQty = parseFloat(String(getVal(item, 'planningPendingQty', 11) || '0').replace(/[^0-9.-]+/g, ''));
            return qVal !== '' && rVal === '' && !isNaN(pendingQty) && pendingQty > 0;
        }).map((item, idx) => ({
            originalIndex: idx,
            orderNumber: item.orderNumber || '-',
            orderDate: item.orderDate || '-',
            clientName: item.clientName || '-',
            godown: item.godownName || '-',
            itemName: item.itemName || '-',
            rate: item.rate || '0',
            orderQty: item.qty || '0',
            currentStock: item.currentStock || '-',
            planningQty: item.planningQty || '0',
            planningPendingQty: item.planningPendingQty || '0',
            qtyDelivered: item.qtyDelivered || '0',
            columnQ: item.columnQ || '',
            columnR: item.columnR || ''
        }));
    }, [rawOrders]);

    const historyItems = useMemo(() => {
        return rawSkip.slice(1)
            .filter(row => row && (getVal(row, 'orderNumber', 0)))
            .map((item, idx) => ({
                originalIndex: idx,
                orderNumber: getVal(item, 'orderNumber', 0) || '-',
                orderDate: getVal(item, 'orderDate', 1) || '-',
                clientName: getVal(item, 'clientName', 2) || '-',
                godown: getVal(item, 'godown', 3) || '-',
                itemName: getVal(item, 'itemName', 4) || '-',
                rate: getVal(item, 'rate', 5) || '0',
                orderQty: getVal(item, 'orderQty', 6) || '0',
                dispatchQty: getVal(item, 'dispatchQty', 7) || '',
                dispatchDate: getVal(item, 'dispatchDate', 8) || '',
                godownName: getVal(item, 'godownName', 9) || '-',
                skipped: true
            }));
    }, [rawSkip]);

    const godowns = useMemo(() => {
        return [...new Set(contextGodowns.flat().map(v => String(v).trim()).filter(v => v && v.toLowerCase() !== 'godown'))].sort();
    }, [contextGodowns]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // Manual Refresh: Trigger global state update
    const handleRefresh = useCallback(() => {
        refreshAll(true);
    }, [refreshAll]);

    // Unique filter options (combine both pending and history)
    const allUniqueClients = useMemo(() =>
        [...new Set([...pendingItems.map(o => o.clientName), ...historyItems.map(h => h.clientName)])].sort(),
        [pendingItems, historyItems]
    );
    const allUniqueGodowns = useMemo(() =>
        [...new Set([...pendingItems.map(o => o.godown), ...historyItems.map(h => h.godown)])].sort(),
        [pendingItems, historyItems]
    );

    // Sorting logic
    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

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

    const currentItems = activeTab === 'pending' ? pendingItems : historyItems;
    const filteredAndSortedItems = useMemo(() =>
        getSortedItems(
            currentItems.filter(item => {
                const matchesSearch = Object.values(item).some(val =>
                    String(val).toLowerCase().includes(searchTerm.toLowerCase())
                );
                const matchesClient = !clientFilter || item.clientName === clientFilter;
                const matchesGodown = !godownFilter || item.godown === godownFilter;
                return matchesSearch && matchesClient && matchesGodown;
            })
        ),
        [currentItems, searchTerm, clientFilter, godownFilter, getSortedItems]
    );

    const filteredItems = filteredAndSortedItems;

    // Check if any row is selected (for conditional column visibility)
    const anySelected = Object.values(selectedRows).some(Boolean);

    // Checkbox toggle
    const handleCheckboxToggle = (originalIdx) => {
        const isSelected = !selectedRows[originalIdx];
        setSelectedRows(prev => ({ ...prev, [originalIdx]: isSelected }));

        if (isSelected) {
            setEditData(prev => ({
                ...prev,
                [originalIdx]: {
                    dispatchQty: '',
                    dispatchDate: new Date().toISOString().split('T')[0],
                    gstIncluded: 'No',
                    godown: pendingItems.find(item => item.originalIndex === originalIdx)?.godown || ''
                }
            }));
        } else {
            const newEditData = { ...editData };
            delete newEditData[originalIdx];
            setEditData(newEditData);
        }
    };

    // Handle edit changes
    const handleEditChange = (originalIdx, field, value) => {
        setEditData(prev => ({
            ...prev,
            [originalIdx]: { ...prev[originalIdx], [field]: value }
        }));
    };

    // Save action – submit selected items to Skip sheet
    const handleSave = async () => {
        const selectedItems = pendingItems.filter(item => selectedRows[item.originalIndex]);
        if (selectedItems.length === 0) return;

        setIsSaving(true);
        try {
            const formatDateForSubmit = (dateStr) => {
                if (!dateStr || dateStr === '-') return '';
                try {
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) return '';
                    const dd = String(date.getDate()).padStart(2, '0');
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const yyyy = date.getFullYear();
                    return `${dd}/${mm}/${yyyy}`;
                } catch {
                    return '';
                }
            };

            const rowsToSubmit = selectedItems.map(item => {
                const edit = editData[item.originalIndex] || {};
                return {
                    orderNumber: item.orderNumber,
                    orderDate: formatDateForSubmit(item.orderDate),
                    clientName: item.clientName,
                    godown: item.godown,
                    itemName: item.itemName,
                    rate: item.rate,
                    orderQty: item.orderQty,
                    dispatchQty: edit.dispatchQty || '',
                    dispatchDate: formatDateForSubmit(edit.dispatchDate),
                    godownName: edit.godown || item.godown
                };
            });

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    sheet: 'Skip',
                    sheetId: SHEET_ID,
                    rows: rowsToSubmit
                })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Unknown error');
            }

            // Success: Update global context
            await refreshAll(true);
            setSelectedRows({});
            setEditData({});

            showToast('Items successfully submitted to Skip sheet.', 'success');
        } catch (error) {
            console.error('Save error:', error);
            showToast(`Save failed: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="">
            {/* Header with title, tabs, filters, and action button */}
            <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded shadow-sm border border-gray-100 max-w-[1200px] mx-auto">
                <h1 className="text-xl font-bold text-gray-800">Skip Delivered</h1>

                <div className="flex bg-gray-100 p-1 rounded">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'pending' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Clock size={16} />
                        Pending
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <History size={16} />
                        History
                    </button>
                </div>

                <div className="flex-1" />

                {/* Refresh button */}
                <button
                    onClick={handleRefresh}
                    disabled={refreshing || isSaving}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs font-bold border border-gray-200 disabled:opacity-50"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>

                <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-32 lg:w-40 px-3 py-2 bg-gray-50 border border-gray-200 rounded focus:ring-primary focus:border-primary"
                />
                <SearchableDropdown
                    value={clientFilter}
                    onChange={setClientFilter}
                    options={allUniqueClients}
                    allLabel="All Clients"
                    className="w-32 lg:w-40"
                    focusColor="primary"
                />
                <SearchableDropdown
                    value={godownFilter}
                    onChange={setGodownFilter}
                    options={allUniqueGodowns}
                    allLabel="All Godowns"
                    className="w-32 lg:w-40"
                    focusColor="primary"
                />

                {activeTab === 'pending' && anySelected && (
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover shadow-md font-bold text-sm disabled:opacity-50"
                    >
                        {isSaving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSaving ? 'Saving...' : 'Mark Skipped'}
                    </button>
                )}
            </div>

            {/* Loading overlay — first load only (background syncs are silent) */}
            {(loading || isSaving) && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/40 backdrop-blur-md transition-all duration-300">
                    <div className="bg-white/80 p-10 rounded-3xl shadow-[0_32px_64px_-15px_rgba(0,0,0,0.1)] flex flex-col items-center gap-6 border border-white/50 relative overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500"></div>
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500"></div>
                        <div className="relative">
                            <svg className="w-16 h-16 animate-spin" viewBox="0 0 50 50">
                                <circle className="opacity-20" cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--primary, #58cc02)' }} />
                                <circle className="opacity-100" cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" style={{ color: 'var(--primary, #58cc02)' }} />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-2 w-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(88,204,2,0.5)]"></div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <h3 className="text-lg font-black text-gray-800 uppercase tracking-[0.3em] mb-1 drop-shadow-sm flex items-center">
                                {isSaving ? 'Saving' : 'Loading'}
                                <span className="inline-flex ml-1">
                                    <span className="animate-bounce" style={{ animationDelay: '0s' }}>.</span>
                                    <span className="animate-bounce [animation-delay:0.2s] ml-0.5">.</span>
                                    <span className="animate-bounce [animation-delay:0.4s] ml-0.5">.</span>
                                </span>
                            </h3>
                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider bg-gray-50 px-3 py-1 rounded-full border border-gray-100 shadow-inner">
                                {isSaving ? 'Processing Skip' : 'Retrieving Data'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Data table */}
            <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden max-w-[1200px] mx-auto">
                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 max-h-[460px] overflow-y-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold sticky top-0 z-10 shadow-sm">
                                {activeTab === 'pending' && <th className="px-6 py-4 text-center">Action</th>}
                                {activeTab === 'pending' && anySelected && (
                                    <>
                                        <th className="px-6 py-4 text-primary-hover text-right">Dispatch Qty</th>
                                        <th className="px-6 py-4 text-primary-hover text-center">Dispatch Date</th>
                                        <th className="px-6 py-4 text-primary-hover text-center">GST Included</th>
                                    </>
                                )}
                                {[
                                    { label: 'Order Number', key: 'orderNumber' },
                                    { label: 'Order Date', key: 'orderDate', align: 'center' },
                                    { label: 'Client Name', key: 'clientName' },
                                    { label: 'Godown', key: 'godown', align: 'center' },
                                    { label: 'Item Name', key: 'itemName' },
                                    { label: 'Rate', key: 'rate', align: 'right' },
                                    { label: 'Order Qty', key: 'orderQty', align: 'right' },
                                    ...(activeTab === 'pending' ? [
                                        { label: 'Current Stock', key: 'currentStock', align: 'right' },
                                        { label: 'Planning Qty', key: 'planningQty', align: 'right' },
                                        { label: 'Planning Pending Qty', key: 'planningPendingQty', align: 'right' },
                                        { label: 'Qty Delivered', key: 'qtyDelivered', align: 'right' }
                                    ] : []),
                                    ...(activeTab === 'history' ? [
                                        { label: 'Dispatch Qty', key: 'dispatchQty', align: 'right' },
                                        { label: 'Dispatch Date', key: 'dispatchDate', align: 'center' },
                                        { label: 'Godown Name', key: 'godownName', align: 'center' }
                                    ] : [])
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
                            {filteredItems.map((item, idx) => {
                                const originalIdx = item.originalIndex || idx;
                                const isSelected = activeTab === 'pending' && !!selectedRows[originalIdx];
                                const edit = editData[originalIdx] || {};
                                return (
                                    <tr key={`${activeTab}-${originalIdx}`} className={isSelected ? 'bg-green-50/50' : 'hover:bg-gray-50'}>
                                        {activeTab === 'pending' && (
                                            <td className="px-6 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleCheckboxToggle(originalIdx)}
                                                    className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                                />
                                            </td>
                                        )}
                                        {/* Extra columns: rendered only if anySelected */}
                                        {activeTab === 'pending' && anySelected && (
                                            <>
                                                <td className="px-6 py-4 text-right">
                                                    {isSelected ? (
                                                        <input
                                                            type="number"
                                                            value={edit.dispatchQty || ''}
                                                            onChange={(e) => handleEditChange(originalIdx, 'dispatchQty', e.target.value)}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary focus:border-primary outline-none text-right"
                                                            placeholder="Qty"
                                                        />
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {isSelected ? (
                                                        <input
                                                            type="date"
                                                            value={formatDateForInput(edit.dispatchDate) || ''}
                                                            onChange={(e) => handleEditChange(originalIdx, 'dispatchDate', e.target.value)}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary focus:border-primary outline-none"
                                                        />
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {isSelected ? (
                                                        <div className="relative">
                                                            <select
                                                                value={edit.gstIncluded || 'No'}
                                                                onChange={(e) => handleEditChange(originalIdx, 'gstIncluded', e.target.value)}
                                                                className="w-full pl-3 pr-8 py-1 border border-gray-300 rounded text-sm appearance-none bg-white focus:ring-primary focus:border-primary outline-none"
                                                            >
                                                                <option value="Yes">Yes</option>
                                                                <option value="No">No</option>
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                        <td className="px-6 py-4 font-semibold text-gray-900">{item.orderNumber}</td>
                                        <td className="px-6 py-4 text-gray-600 text-xs text-center">{formatDisplayDate(item.orderDate)}</td>
                                        <td className="px-6 py-4 font-medium text-gray-800">{item.clientName}</td>
                                        <td className="px-6 py-4 text-gray-600 text-center">
                                            {isSelected ? (
                                                <SearchableDropdown
                                                    value={edit.godown || ''}
                                                    onChange={(val) => handleEditChange(originalIdx, 'godown', val)}
                                                    options={godowns}
                                                    placeholder="Select Godown"
                                                    showAll={false}
                                                    className="w-full text-left"
                                                />
                                            ) : (
                                                item.godown
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{item.itemName}</td>
                                        <td className="px-6 py-4 text-gray-600 text-right">{item.rate}</td>
                                        <td className="px-6 py-4 text-gray-600 text-right font-bold">{item.orderQty}</td>
                                        {activeTab === 'pending' && (
                                            <>
                                                <td className="px-6 py-4 text-gray-600 text-right">{item.currentStock}</td>
                                                <td className="px-6 py-4 font-bold text-primary text-right">{item.planningQty}</td>
                                                <td className="px-6 py-4 text-gray-600 text-right">{item.planningPendingQty}</td>
                                                <td className="px-6 py-4 text-gray-600 text-right">{item.qtyDelivered}</td>
                                            </>
                                        )}
                                        {activeTab === 'history' && (
                                            <>
                                                <td className="px-6 py-4 text-gray-600 border-l border-gray-100 text-right font-bold">{item.dispatchQty}</td>
                                                <td className="px-6 py-4 text-gray-600 text-xs text-center">{formatDisplayDate(item.dispatchDate)}</td>
                                                <td className="px-6 py-4 text-gray-600 text-center">{item.godownName}</td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={
                                            activeTab === 'pending'
                                                ? (anySelected ? 15 : 12)
                                                : 10
                                        }
                                        className="px-4 py-8 text-center text-gray-500 italic"
                                    >
                                        No items found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile card view */}
                <div className="md:hidden divide-y divide-gray-200">
                    {filteredItems.map((item, idx) => {
                        const originalIdx = item.originalIndex || idx;
                        const isSelected = activeTab === 'pending' && !!selectedRows[originalIdx];
                        const edit = editData[originalIdx] || {};
                        return (
                            <div key={`${activeTab}-${originalIdx}`} className={`p-4 space-y-3 ${isSelected ? 'bg-green-50/30' : 'bg-white'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3 items-start">
                                        {activeTab === 'pending' && (
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleCheckboxToggle(originalIdx)}
                                                className="mt-1 rounded text-primary focus:ring-primary w-5 h-5 cursor-pointer"
                                            />
                                        )}
                                        <div>
                                            <p className="text-[10px] font-bold text-primary uppercase leading-none mb-1">{item.orderNumber}</p>
                                            <h4 className="text-sm font-bold text-gray-900 leading-tight">{item.clientName}</h4>
                                            <p className="text-[10px] mt-1 text-gray-500">{item.itemName}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] text-gray-600 pt-1">
                                    {activeTab === 'pending' && isSelected && (
                                        <>
                                            <div>
                                                <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Dispatch Qty</span>
                                                <input
                                                    type="number"
                                                    value={edit.dispatchQty || ''}
                                                    onChange={(e) => handleEditChange(originalIdx, 'dispatchQty', e.target.value)}
                                                    className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                                />
                                            </div>
                                            <div>
                                                <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Dispatch Date</span>
                                                <input
                                                    type="date"
                                                    value={formatDateForInput(edit.dispatchDate) || ''}
                                                    onChange={(e) => handleEditChange(originalIdx, 'dispatchDate', e.target.value)}
                                                    className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">GST Included</span>
                                                <select
                                                    value={edit.gstIncluded || 'No'}
                                                    onChange={(e) => handleEditChange(originalIdx, 'gstIncluded', e.target.value)}
                                                    className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                                >
                                                    <option value="Yes">Yes</option>
                                                    <option value="No">No</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                    <div>
                                        <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Order Date</span>
                                        <p className="font-medium">{formatDisplayDate(item.orderDate)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Godown</span>
                                        {activeTab === 'pending' && isSelected ? (
                                            <SearchableDropdown
                                                value={edit.godown || ''}
                                                onChange={(val) => handleEditChange(originalIdx, 'godown', val)}
                                                options={godowns}
                                                placeholder="Select Godown"
                                                showAll={false}
                                                className="w-full"
                                            />
                                        ) : (
                                            <p className="font-medium truncate">{item.godown}</p>
                                        )}
                                        {activeTab === 'history' && (
                                            <>
                                                <div>
                                                    <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Dispatch Qty</span>
                                                    <p className="font-medium">{item.dispatchQty}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Dispatch Date</span>
                                                    <p className="font-medium">{formatDisplayDate(item.dispatchDate)}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Godown Name</span>
                                                    <p className="font-medium">{item.godownName}</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Rate</span>
                                        <p className="font-medium">₹{item.rate}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Order Qty</span>
                                        <p className="font-medium">{item.orderQty}</p>
                                    </div>
                                    {activeTab === 'pending' && (
                                        <>
                                            <div>
                                                <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Current Stock</span>
                                                <p className="font-medium">{item.currentStock}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Planning Qty</span>
                                                <p className="font-bold text-primary">{item.planningQty}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Planning Pending</span>
                                                <p className="font-medium">{item.planningPendingQty}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tight">Qty Delivered</span>
                                                <p className="font-medium">{item.qtyDelivered}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <div className="p-8 text-center text-gray-500 italic text-sm">No items found.</div>
                    )}
                </div>
            </div>

            {/* Clear filters button */}
            {(searchTerm || clientFilter || godownFilter) && (
                <div className="flex justify-end mt-4">
                    <button
                        onClick={() => { setSearchTerm(''); setClientFilter(''); setGodownFilter(''); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors text-xs font-bold"
                    >
                        <X size={14} />
                        Clear Filters
                    </button>
                </div>
            )}
        </div>
    );
};

export default SkipDelivered;
