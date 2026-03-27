import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Mail, History, Save, ChevronUp, ChevronDown, RefreshCw, ClipboardList, CheckCircle } from 'lucide-react';
import SearchableDropdown from '../../components/SearchableDropdown';
import { useToast } from '../../contexts/ToastContext';

// --- Constants ---
const API_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;
const SHEET_ID = import.meta.env.VITE_orderToDispatch_SHEET_ID;

// --- Helper: get value from object regardless of key casing/spaces ---
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

// --- Format date for display ---
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

// --- High-Fidelity Skeletons ---
const TableSkeleton = () => (
  <div className="w-full space-y-4 p-4">
    <div className="h-10 bg-gray-100 rounded-lg w-full mb-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
    </div>
    {[...Array(6)].map((_, i) => (
      <div key={i} className="flex space-x-4 border-b border-gray-50 pb-4 relative overflow-hidden">
        {[1 / 12, 2 / 12, 2 / 12, 3 / 12, 2 / 12, 1 / 12, 1 / 12].map((width, j) => (
          <div key={j} style={{ width: `${width * 100}%` }} className="h-4 bg-gray-50 rounded relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

const MobileSkeleton = () => (
  <div className="p-4 space-y-6">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4 relative overflow-hidden">
        <div className="flex justify-between">
          <div className="h-4 bg-gray-100 rounded w-1/3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
          </div>
          <div className="h-4 bg-gray-100 rounded w-1/4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
          </div>
        </div>
        <div className="h-6 bg-gray-50 rounded w-3/4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-3 bg-gray-50 rounded w-full relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
          </div>
          <div className="h-3 bg-gray-50 rounded w-full relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const AfterDispatchInformToParty = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRows, setSelectedRows] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [godownFilter, setGodownFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isSaving, setIsSaving] = useState(false);

  const [pendingItems, setPendingItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const abortControllerRef = useRef(null);

  // --- Fetch Data ---
  const fetchData = useCallback(async (isRefresh = false) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    // Minimum display time so the skeleton animation is clearly visible
    const MIN_DISPLAY_MS = 1500;
    const minTimer = new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_MS));

    const doFetch = async () => {
      // 1. Fetch Pending from Planning Sheet
      const pendingUrl = new URL(API_URL);
      pendingUrl.searchParams.set('sheet', 'Planning');
      pendingUrl.searchParams.set('mode', 'table');
      if (SHEET_ID) pendingUrl.searchParams.set('sheetId', SHEET_ID);

      const pendingRes = await fetch(pendingUrl.toString(), { signal: controller.signal });
      const pendingResult = await pendingRes.json();

      let pMapped = [];
      if (pendingResult.success && Array.isArray(pendingResult.data)) {
        pMapped = pendingResult.data.slice(3).map((item, idx) => ({
          originalIndex: idx,
          sheetRow: item.sheetRow,
          dispatchNo: getVal(item, 'dispatchNo', 'Dispatch No') || '-',
          dispatchDate: getVal(item, 'dispatchDate', 'Dispatch Date') || '-',
          orderNo: getVal(item, 'orderNumber', 'orderNo', 'Order No') || '-',
          customerName: getVal(item, 'clientName', 'customer', 'Customer Name', 'Client Name') || '-',
          productName: getVal(item, 'itemName', 'product', 'Product Name', 'Item Name') || '-',
          godown: getVal(item, 'godownName', 'godown', 'Godown Name') || '-',
          crmName: getVal(item, 'crmName', 'CRM') || '-',
          orderQty: getVal(item, 'qty', 'orderQty', 'Order Qty') || '0',
          dispatchQty: getVal(item, 'dispatchQty', 'Dispatch Qty') || '0',
          columnT: item.columnT || '',
          columnU: item.columnU || ''
        })).filter(item => {
          const colT = String(item.columnT || '').trim();
          const colU = String(item.columnU || '').trim();
          return colT === '' || colU === '';
        });
      }

      // 2. Fetch History from After Dispatch Sheet
      const historyUrl = new URL(API_URL);
      historyUrl.searchParams.set('sheet', 'After Dispatch');
      historyUrl.searchParams.set('mode', 'table');
      if (SHEET_ID) historyUrl.searchParams.set('sheetId', SHEET_ID);

      const historyRes = await fetch(historyUrl.toString(), { signal: controller.signal });
      const historyResult = await historyRes.json();

      let hMapped = [];
      if (historyResult.success && Array.isArray(historyResult.data)) {
        hMapped = historyResult.data.map((item, idx) => ({
          originalIndex: item.originalIndex !== undefined ? item.originalIndex : idx,
          dispatchNo: getVal(item, 'dispatchNo', 'Dispatch No') || (Array.isArray(item) ? item[1] : '-'),
          customerName: getVal(item, 'customer', 'customerName') || (Array.isArray(item) ? item[2] : '-'),
          godown: getVal(item, 'godown') || (Array.isArray(item) ? item[3] : '-'),
          productName: getVal(item, 'product', 'productName') || (Array.isArray(item) ? item[4] : '-'),
          crmName: getVal(item, 'crmName') || (Array.isArray(item) ? item[5] : '-'),
          orderQty: getVal(item, 'orderQty') || (Array.isArray(item) ? item[6] : '0'),
          dispatchQty: getVal(item, 'dispatchQty') || (Array.isArray(item) ? item[7] : '0'),
          status: getVal(item, 'status') || (Array.isArray(item) ? item[8] : '-'),
          notified: true
        }));
      }

      return { pMapped, hMapped };
    };

    try {
      // Wait for BOTH the data fetch AND the minimum display timer
      const [result] = await Promise.all([doFetch(), minTimer]);
      if (!controller.signal.aborted) {
        setPendingItems(result.pMapped);
        setHistoryItems(result.hMapped);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('fetchData error:', error);
        showToast('Error', 'Failed to load items');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    }
  }, [showToast]);


  useEffect(() => {
    fetchData();
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, [fetchData]);

  // --- Filtering & Sorting ---
  const allUniqueClients = useMemo(() =>
    [...new Set([...pendingItems.map(o => o.customerName), ...historyItems.map(h => h.customerName)])].sort(),
    [pendingItems, historyItems]
  );
  const allUniqueGodowns = useMemo(() =>
    [...new Set([...pendingItems.map(o => o.godown), ...historyItems.map(h => h.godown)])].sort(),
    [pendingItems, historyItems]
  );

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortedItems = useCallback((itemsToSort) => {
    if (!sortConfig.key) return itemsToSort;
    return [...itemsToSort].sort((a, b) => {
      let aVal = a[sortConfig.key], bVal = b[sortConfig.key];
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

  const filteredAndSortedPending = useMemo(() => {
    const filtered = pendingItems.filter(item => {
      const matchesSearch = Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesClient = !clientFilter || item.customerName === clientFilter;
      const matchesGodown = !godownFilter || item.godown === godownFilter;
      return matchesSearch && matchesClient && matchesGodown;
    });
    return getSortedItems(filtered);
  }, [pendingItems, searchTerm, clientFilter, godownFilter, getSortedItems]);

  const filteredAndSortedHistory = useMemo(() => {
    const filtered = historyItems.filter(item => {
      const matchesSearch = Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesClient = !clientFilter || item.customerName === clientFilter;
      const matchesGodown = !godownFilter || item.godown === godownFilter;
      return matchesSearch && matchesClient && matchesGodown;
    });
    return getSortedItems(filtered);
  }, [historyItems, searchTerm, clientFilter, godownFilter, getSortedItems]);

  // --- Actions ---
  const handleCheckboxToggle = (realIdx) => {
    setSelectedRows(prev => ({ ...prev, [realIdx]: !prev[realIdx] }));
  };

  const handleSave = async () => {
    const selectedItems = pendingItems.filter(item => selectedRows[item.originalIndex]);
    if (selectedItems.length === 0) return;

    setIsSaving(true);
    try {
      const rowsToSubmit = selectedItems.map(item => ({
        dispatchNo: item.dispatchNo,
        customer: item.customerName,
        godown: item.godown,
        productName: item.productName,
        crmName: item.crmName,
        orderQty: item.orderQty,
        dispatchQty: item.dispatchQty,
        status: "yes"
      }));

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sheet: 'After Dispatch', sheetId: SHEET_ID, rows: rowsToSubmit })
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      showToast('Notification status updated successfully!', 'success');
      setSelectedRows({});
      fetchData(true);
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to save data', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = () => fetchData(true);

  return (
    <div className="">
      {/* Background Refresh Progress */}
      {isRefreshing && !isLoading && (
        <div className="fixed top-0 left-0 right-0 h-1 z-[100] bg-gray-100 overflow-hidden">
          <div className="h-full bg-primary animate-shimmer-fast w-full origin-left"></div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="max-w-[1400px] mx-auto mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Row 1: Title & Tabs */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-50 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Mail size={22} /></div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none mb-1.5">Inform to Party</h1>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">After Dispatch Notifications</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-gray-100/80 p-1 rounded-xl border border-gray-200/50">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <ClipboardList size={16} /> PENDING
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <History size={16} /> HISTORY
              </button>
            </div>
          </div>

          {/* Row 2: Filters & Actions */}
          <div className="px-6 py-4 bg-gray-50/30 flex flex-wrap items-center gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 min-w-[300px]">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center text-gray-400"><RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /></div>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <SearchableDropdown value={clientFilter} onChange={setClientFilter} options={allUniqueClients} allLabel="ALL CLIENTS" placeholder="Client" />
              <SearchableDropdown value={godownFilter} onChange={setGodownFilter} options={allUniqueGodowns} allLabel="ALL GODOWNS" placeholder="Godown" />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleRefresh} disabled={isRefreshing} className="px-4 py-2 bg-white text-gray-700 rounded-xl hover:bg-gray-50 text-xs font-black border border-gray-200 shadow-sm flex items-center gap-2">
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /> REFRESH
              </button>
              {activeTab === 'pending' && Object.values(selectedRows).some(v => v) && (
                <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-primary text-white rounded-xl hover:opacity-90 shadow-lg shadow-primary/20 font-black text-xs tracking-widest flex items-center gap-2">
                  {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                  {isSaving ? 'SAVING...' : 'CONFIRM NOTIFY'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                {activeTab === 'pending' ? (
                  <>
                    <th className="px-6 py-4 text-center w-16">
                      <input
                        type="checkbox"
                        checked={pendingItems.length > 0 && filteredAndSortedPending.every(it => selectedRows[it.originalIndex])}
                        onChange={() => {
                          const allCurrent = filteredAndSortedPending.map(it => it.originalIndex);
                          const allSelected = allCurrent.every(idx => selectedRows[idx]);
                          setSelectedRows(prev => {
                            const next = { ...prev };
                            allCurrent.forEach(idx => { if (allSelected) delete next[idx]; else next[idx] = true; });
                            return next;
                          });
                        }}
                        className="rounded-md w-5 h-5 cursor-pointer"
                      />
                    </th>
                    {[
                      { label: 'Dispatch No', key: 'dispatchNo' },
                      { label: 'Dispatch Date', key: 'dispatchDate', align: 'center' },
                      { label: 'Order No', key: 'orderNo' },
                      { label: 'Customer', key: 'customerName' },
                      { label: 'Product', key: 'productName' },
                      { label: 'Godown', key: 'godown', align: 'center' },
                      { label: 'CRM Name', key: 'crmName' },
                      { label: 'Order Qty', key: 'orderQty', align: 'right' },
                      { label: 'Status', key: 'status', align: 'center' },
                      { label: 'Dispatch Qty', key: 'dispatchQty', align: 'right' },
                    ].map(col => (
                      <th key={col.key} className={`px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => requestSort(col.key)}>
                        <div className={`flex items-center gap-1.5 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                          <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">{col.label}</span>
                          <div className="flex flex-col text-gray-300">
                            <ChevronUp size={10} className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'text-primary' : ''} />
                            <ChevronDown size={10} className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'text-primary' : ''} />
                          </div>
                        </div>
                      </th>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { label: 'Dispatch Number', key: 'dispatchNo' },
                      { label: 'Customer Name', key: 'customerName' },
                      { label: 'Godown', key: 'godown', align: 'center' },
                      { label: 'Product Name', key: 'productName' },
                      { label: 'CRM Name', key: 'crmName' },
                      { label: 'Order Qty', key: 'orderQty', align: 'right' },
                      { label: 'Dispatch Qty', key: 'dispatchQty', align: 'right' },
                      { label: 'Status', key: 'status', align: 'center' },
                    ].map(col => (
                      <th key={col.key} className={`px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => requestSort(col.key)}>
                        <div className={`flex items-center gap-1.5 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                          <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">{col.label}</span>
                          <div className="flex flex-col text-gray-300">
                            <ChevronUp size={10} className={sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'text-primary' : ''} />
                            <ChevronDown size={10} className={sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'text-primary' : ''} />
                          </div>
                        </div>
                      </th>
                    ))}
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan="11">
                    <TableSkeleton />
                  </td>
                </tr>
              ) : (activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).length === 0 ? (
                <tr><td colSpan="11" className="px-4 py-20 text-center text-gray-400 italic font-bold text-sm">No entries found for this selection.</td></tr>
              ) : (activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).map(item => {
                const isSelected = activeTab === 'pending' && !!selectedRows[item.originalIndex];
                return (
                  <tr key={item.originalIndex} className={`group ${isSelected ? 'bg-primary/5' : 'hover:bg-gray-50/50'} transition-all`}>
                    {activeTab === 'pending' ? (
                      <>
                        <td className="px-6 py-4 text-center">
                          <input type="checkbox" checked={isSelected} onChange={() => handleCheckboxToggle(item.originalIndex)} className="rounded-md w-5 h-5 cursor-pointer" />
                        </td>
                        <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-black text-[10px] tracking-wider uppercase">{item.dispatchNo}</span></td>
                        <td className="px-6 py-4 text-center font-bold text-[11px] text-gray-500">{formatDisplayDate(item.dispatchDate)}</td>
                        <td className="px-6 py-4 text-gray-600 text-[13px]">{item.orderNo}</td>
                        <td className="px-6 py-4 font-bold text-gray-900 text-sm">{item.customerName}</td>
                        <td className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-tighter truncate max-w-[200px]">{item.productName}</td>
                        <td className="px-6 py-4 text-center text-gray-600 font-bold text-[12px]">{item.godown}</td>
                        <td className="px-6 py-4 text-gray-400 text-[11px] italic">{item.crmName}</td>
                        <td className="px-6 py-4 text-right text-gray-700 font-black text-[13px]">{item.orderQty}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-600`}>
                            Pending
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-primary text-[14px]">{item.dispatchQty}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-black text-[10px] tracking-wider uppercase">{item.dispatchNo}</span></td>
                        <td className="px-6 py-4 font-bold text-gray-900 text-sm">{item.customerName}</td>
                        <td className="px-6 py-4 text-center text-gray-600 font-bold text-[12px]">{item.godown}</td>
                        <td className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-tighter truncate max-w-[200px]">{item.productName}</td>
                        <td className="px-6 py-4 text-gray-400 text-[11px] italic">{item.crmName}</td>
                        <td className="px-6 py-4 text-right text-gray-700 font-black text-[13px]">{item.orderQty}</td>
                        <td className="px-6 py-4 text-right font-black text-primary text-[14px]">{item.dispatchQty}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600`}>
                            {item.status}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AfterDispatchInformToParty;