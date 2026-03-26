import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle, History, Save, Loader, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import SearchableDropdown from '../../components/SearchableDropdown';
import { useToast } from '../../contexts/ToastContext';
import { useDataSync } from '../../utils/useDataSync';

// --- Constants ---
const API_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;
const MASTER_URL = import.meta.env.VITE_MASTER_URL;
const SHEET_ID = import.meta.env.VITE_orderToDispatch_SHEET_ID;

const CACHE_KEY_PENDING = 'dispatchCompletePending';
const CACHE_KEY_HISTORY = 'dispatchCompleteHistory';

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

// --- Format date for display (e.g., 25-Feb-2026) ---
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
  } catch {
    return dateStr;
  }
};

// --- Format date for input (YYYY-MM-DD) ---
const formatDateToYYYYMMDD = (dateVal) => {
  if (!dateVal) return '';
  try {
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return dateVal;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return dateVal;
  }
};

const DispatchComplete = () => {
  const { showToast } = useToast();

  // --- UI state ---
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRows, setSelectedRows] = useState({});
  const [editData, setEditData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [godownFilter, setGodownFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isSaving, setIsSaving] = useState(false);

  // --- Master data (item names, godowns) ---
  const [itemNames, setItemNames] = useState([]);
  const [godowns, setGodowns] = useState([]);

  // --- Fetch function for pending orders (Planning sheet) ---
  const fetchPendingOrders = useCallback(async (signal) => {
    const url = new URL(API_URL);
    url.searchParams.set('sheet', 'Planning');
    url.searchParams.set('mode', 'table');
    if (SHEET_ID) url.searchParams.set('sheetId', SHEET_ID);

    const response = await fetch(url.toString(), { signal });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch (e) { return []; }

    let dataArray = [];
    if (Array.isArray(result)) dataArray = result;
    else if (result.success && Array.isArray(result.data)) dataArray = result.data;
    else if (result.data && Array.isArray(result.data)) dataArray = result.data;
    else if (result.rows && Array.isArray(result.rows)) dataArray = result.rows;

    if (!dataArray.length) return [];

    const hasHeaders = Array.isArray(dataArray[0]) &&
      (String(dataArray[0][0]).toLowerCase().includes('dispatch') ||
       String(dataArray[0][1]).toLowerCase().includes('no'));

    const processArray = hasHeaders ? dataArray.slice(1) : dataArray;
    return processArray.slice(3)
      .map((item, idx) => {
        if (Array.isArray(item)) {
          return {
            originalIndex: idx,
            dispatchNo: item[0] || '-',
            dispatchDate: item[1] || '-',
            orderNumber: item[2] || '-',
            clientName: item[3] || '-',
            itemName: item[4] || '-',
            godownName: item[5] || '-',
            qty: item[6] || '0',
            dispatchQty: item[7] || '0',
            crmName: item[8] || '-',
            columnO: item[14] || '',
            columnP: item[15] || '',
            sheetRow: item[9] || (idx + (hasHeaders ? 2 : 1)),
            status: getVal(item, 'status', 'Status', 17) || ''
          };
        } else {
          return {
            ...item,
            originalIndex: idx,
            dispatchNo: getVal(item, 'dispatchNo', 'Dispatch No'),
            dispatchDate: getVal(item, 'dispatchDate', 'Dispatch Date'),
            orderNumber: getVal(item, 'orderNumber', 'orderNo', 'Order No'),
            clientName: getVal(item, 'clientName', 'customer', 'Customer Name', 'Client Name'),
            itemName: getVal(item, 'itemName', 'product', 'Product Name', 'Item Name'),
            godownName: getVal(item, 'godownName', 'godown', 'Godown Name'),
            qty: getVal(item, 'qty', 'orderQty', 'Order Qty'),
            dispatchQty: getVal(item, 'dispatchQty', 'Dispatch Qty'),
            crmName: getVal(item, 'crmName', 'CRM Name'),
            columnO: getVal(item, 'columnO', 'O'),
            columnP: getVal(item, 'columnP', 'P'),
            status: String(getVal(item, 'status', 'Status') || '').toLowerCase(),
            sheetRow: getVal(item, 'sheetRow', 'row')
          };
        }
      })
      .filter(item => {
        const colOValue = String(item.columnO || '').trim();
        const colPValue = String(item.columnP || '').trim();
        const bothNotNull = colOValue !== '' && colOValue !== '-' && colPValue !== '' && colPValue !== '-';
        return !bothNotNull;
      });
  }, [API_URL, SHEET_ID]);

  // --- Fetch history from Dispatch Completed sheet ---
  const fetchHistory = useCallback(async (signal) => {
    const url = new URL(API_URL);
    url.searchParams.set('sheet', 'Dispatch Completed');
    url.searchParams.set('mode', 'table');
    if (SHEET_ID) url.searchParams.set('sheetId', SHEET_ID);

    const response = await fetch(url.toString(), { signal });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch (e) { return []; }

    let dataArray = [];
    if (Array.isArray(result)) dataArray = result;
    else if (result.success && Array.isArray(result.data)) dataArray = result.data;
    else if (result.data && Array.isArray(result.data)) dataArray = result.data;
    else if (result.rows && Array.isArray(result.rows)) dataArray = result.rows;

    if (!dataArray.length) return [];

    const hasHeaders = Array.isArray(dataArray[0]) &&
      (String(dataArray[0][0]).toLowerCase().includes('planning') || 
       String(dataArray[0][1]).toLowerCase().includes('dispatch') ||
       String(dataArray[0][0]).toLowerCase().includes('dispatch'));

    const processArray = hasHeaders ? dataArray.slice(1) : dataArray;
    return processArray.map((item, idx) => {
      if (Array.isArray(item)) {
        return {
          originalIndex: idx,
          dispatchNo: item[1] || '-',
          dispatchDate: item[2] || '-',
          completeDate: item[3] || '-',
          customer: item[4] || '-',
          product: item[5] || '-',
          godown: item[6] || '-',
          orderQty: item[7] || '0',
          dispatchQty: item[8] || '0',
          status: item[9] || 'approved',
          crmName: item[10] || '-'
        };
      } else {
        return {
          ...item,
          originalIndex: idx,
          dispatchNo: getVal(item, 'dispatchNo', 'Dispatch No'),
          dispatchDate: getVal(item, 'dispatchDate', 'Dispatch Date'),
          completeDate: getVal(item, 'completeDate', 'Complete Date', 'Date'),
          customer: getVal(item, 'customer', 'Customer', 'Customer Name'),
          product: getVal(item, 'product', 'Product', 'Product Name'),
          godown: getVal(item, 'godown', 'Godown Name', 'Godown'),
          orderQty: getVal(item, 'orderQty', 'Order Qty'),
          dispatchQty: getVal(item, 'dispatchQty', 'Dispatch Qty'),
          status: getVal(item, 'status', 'Status'),
          crmName: getVal(item, 'crmName', 'CRM Name')
        };
      }
    });
  }, [API_URL, SHEET_ID]);

  // --- Use data sync hooks ---
  const { data: orders, loading: loadingOrders, refreshing: refreshingOrders, refresh: refreshOrders } = useDataSync(
    'Planning',
    fetchPendingOrders,
    CACHE_KEY_PENDING,
    10 * 60 * 1000
  );
  const { data: historyItems, loading: loadingHistory, refreshing: refreshingHistory, refresh: refreshHistory } = useDataSync(
    'Dispatch Completed',
    fetchHistory,
    CACHE_KEY_HISTORY,
    10 * 60 * 1000
  );

  const isLoading = loadingOrders || loadingHistory;     // first-load only
  const isRefreshing = refreshingOrders || refreshingHistory; // manual refresh

  // --- Fetch master data (item names, godowns) ---
  const fetchMasterData = useCallback(async () => {
    if (!MASTER_URL) return;
    try {
      const [productsRes, godownsRes] = await Promise.all([
        fetch(`${MASTER_URL}?sheet=Products`),
        fetch(`${MASTER_URL}?sheet=Products&col=4`)
      ]);

      const productsResult = await productsRes.json();
      let newItems = [];
      if (productsResult.success && productsResult.data) {
        newItems = productsResult.data
          .slice(1)
          .map(row => Array.isArray(row) ? row[0] : row)
          .filter(val => val && String(val).trim() !== "");
        newItems = [...new Set(newItems)].sort();
      }

      const godownsResult = await godownsRes.json();
      let newGodowns = [];
      if (godownsResult.success && godownsResult.data) {
        newGodowns = godownsResult.data
          .flat()
          .map(val => String(val).trim())
          .filter(val => val && val.toLowerCase() !== "godown");
        newGodowns = [...new Set(newGodowns)].sort();
      }

      setItemNames(newItems);
      setGodowns(newGodowns);
    } catch (error) {
      console.error('Error fetching master data:', error);
    }
  }, [MASTER_URL]);

  // Initial load of master data (no cache for now)
  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  // Clear selection/edit data when tab changes
  useEffect(() => {
    setSelectedRows({});
    setEditData({});
  }, [activeTab]);

  // --- Memoized unique values for filters ---
  const allUniqueClients = useMemo(() =>
    [...new Set([...(orders || []).map(o => o.clientName), ...(historyItems || []).map(h => h.customer)])].sort(),
    [orders, historyItems]
  );
  const allUniqueGodowns = useMemo(() =>
    [...new Set([...(orders || []).map(o => o.godownName), ...(historyItems || []).map(h => h.godown)])].sort(),
    [orders, historyItems]
  );

  // --- Sorting logic ---
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

  const filteredAndSortedPending = useMemo(() =>
    getSortedItems(
      (orders || []).filter(item => {
        const matchesSearch = Object.values(item).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesClient = clientFilter === '' || item.clientName === clientFilter;
        const matchesGodown = godownFilter === '' || item.godownName === godownFilter;
        return matchesSearch && matchesClient && matchesGodown;
      })
    ),
    [orders, searchTerm, clientFilter, godownFilter, getSortedItems]
  );

  const filteredAndSortedHistory = useMemo(() =>
    getSortedItems(
      (historyItems || []).filter(item => {
        const matchesSearch = Object.values(item).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesClient = clientFilter === '' || item.customer === clientFilter;
        const matchesGodown = godownFilter === '' || item.godown === godownFilter;
        return matchesSearch && matchesClient && matchesGodown;
      })
    ),
    [historyItems, searchTerm, clientFilter, godownFilter, getSortedItems]
  );

  // --- Actions ---
  const handleCheckboxToggle = useCallback((realIdx, item) => {
    setSelectedRows(prev => {
      const isSelected = !prev[realIdx];
      const next = { ...prev, [realIdx]: isSelected };
      if (isSelected) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        setEditData(prevEdit => ({
          ...prevEdit,
          [realIdx]: {
            product: item.itemName,
            godown: item.godownName,
            dispatchQty: item.dispatchQty,
            completeDate: yesterdayStr,
            status: 'Completed'
          }
        }));
      } else {
        setEditData(prevEdit => {
          const newEditData = { ...prevEdit };
          delete newEditData[realIdx];
          return newEditData;
        });
      }
      return next;
    });
  }, []);

  const handleEditChange = useCallback((idx, field, value) => {
    setEditData(prev => ({
      ...prev,
      [idx]: { ...prev[idx], [field]: value }
    }));
  }, []);

  const handleSave = useCallback(async () => {
    const rowsToSubmit = [];
    const indicesToRemove = [];

    Object.keys(selectedRows).forEach(idxStr => {
      const idx = parseInt(idxStr);
      if (selectedRows[idx]) {
        const originalItem = (orders || []).find(o => o.originalIndex === idx);
        if (!originalItem) return;
        const edit = editData[idx] || {};
        rowsToSubmit.push({
          planningRowNumber: originalItem.sheetRow,
          dispatchNo: originalItem.dispatchNo,
          dispatchDate: formatDateToYYYYMMDD(originalItem.dispatchDate),
          completeDate: formatDateToYYYYMMDD(edit.completeDate || (() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return d;
          })()),
          customer: originalItem.clientName,
          product: edit.product || originalItem.itemName,
          godown: edit.godown || originalItem.godownName,
          orderQty: originalItem.qty,
          dispatchQty: edit.dispatchQty || originalItem.dispatchQty,
          status: edit.status || 'Completed',
          crmName: originalItem.crmName
        });
        indicesToRemove.push(idx);
      }
    });

    if (rowsToSubmit.length === 0) return;

    setIsSaving(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sheet: 'Dispatch Completed',
          rows: rowsToSubmit,
          sheetId: SHEET_ID
        })
      });
      const result = await response.json();
      if (result.success) {
        // Invalidate caches and refresh both data sources
        sessionStorage.removeItem(CACHE_KEY_PENDING);
        sessionStorage.removeItem(CACHE_KEY_HISTORY);
        await refreshOrders();
        await refreshHistory();
        setSelectedRows({});
        setEditData({});
        showToast('Dispatch status updated successfully!', 'success');
      } else {
        showToast(`Error saving: ${result.error}`, 'error');
      }
    } catch (error) {
      showToast(`Network error: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [selectedRows, orders, editData, refreshOrders, refreshHistory, showToast, API_URL, SHEET_ID]);

  // Manual refresh: clear caches and force refetch
  const handleRefresh = useCallback(() => {
    sessionStorage.removeItem(CACHE_KEY_PENDING);
    sessionStorage.removeItem(CACHE_KEY_HISTORY);
    refreshOrders();
    refreshHistory();
    fetchMasterData(); // also refresh master data
  }, [refreshOrders, refreshHistory, fetchMasterData]);

  return (
    <div className="">
      {/* Header Card */}
      <div className="flex flex-col gap-4 mb-6 bg-white p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 max-w-[1200px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">Dispatch Completed</h1>
            <div className="flex bg-gray-100 p-1 rounded">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'pending' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <CheckCircle size={16} />
                Pending
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <History size={16} />
                History
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isSaving}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs font-bold border border-gray-200 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            {activeTab === 'pending' && Object.values(selectedRows).some(v => v) && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover shadow-md font-bold text-xs disabled:opacity-50"
              >
                {isSaving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? 'Saving...' : 'Save Completion'}
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-primary mb-1 uppercase">Search</label>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded focus:ring-primary focus:border-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-primary mb-1 uppercase">Client</label>
            <SearchableDropdown
              value={clientFilter}
              onChange={setClientFilter}
              options={allUniqueClients}
              allLabel="All Clients"
              className="w-full"
              focusColor="primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-primary mb-1 uppercase">Godown</label>
            <SearchableDropdown
              value={godownFilter}
              onChange={setGodownFilter}
              options={allUniqueGodowns}
              allLabel="All Godowns"
              className="w-full"
              focusColor="primary"
            />
          </div>
        </div>
      </div>

      {/* Loading - Saving Overlay - first load or save only (background syncs are silent) */}
      {(isLoading || isSaving) && (
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
                {isSaving ? 'Completing Dispatch' : 'Updating Data'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden max-w-[1200px] mx-auto">
        {/* Desktop Table */}
        <div className="hidden md:block relative overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 max-h-[460px] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[1200px] mx-0">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr className="text-xs uppercase text-gray-600 font-bold">
                {activeTab === 'pending' && <th className="px-6 py-4 text-center">Action</th>}
                {[
                  { label: 'Dispatch No', key: 'dispatchNo' },
                  { label: 'Dispatch Date', key: 'dispatchDate', align: 'center' },
                  ...(activeTab === 'pending' ? [{ label: 'Order No', key: 'orderNumber' }] : []),
                  { label: 'Customer', key: activeTab === 'pending' ? 'clientName' : 'customer' },
                  { label: 'Product', key: activeTab === 'pending' ? 'itemName' : 'product' },
                  { label: 'Godown', key: activeTab === 'pending' ? 'godownName' : 'godown', align: 'center' },
                  { label: 'Order Qty', key: activeTab === 'pending' ? 'qty' : 'orderQty', align: 'right' },
                  { label: 'Dispatch Qty', key: 'dispatchQty', align: 'right' },
                  { label: 'Complete Date', key: 'completeDate', align: 'center' },
                  { label: 'Status', key: 'status', align: 'center', minWidth: activeTab === 'pending' ? '140px' : '120px' },
                  ...(activeTab === 'pending' ? [{ label: 'CRM Name', key: 'crmName' }] : [])
                ].map((col) => (
                  <th
                    key={col.key}
                    className={`px-6 py-4 cursor-pointer hover:bg-gray-100/50 transition-colors ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.color === 'green' ? 'text-green-700' : ''}`}
                    style={col.minWidth ? { minWidth: col.minWidth } : {}}
                    onClick={() => requestSort(col.key)}
                  >
                    <div className={`flex items-center gap-1.5 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
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
              {(activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).map((item) => {
                const realIdx = item.originalIndex;
                const isSelected = activeTab === 'pending' && !!selectedRows[realIdx];
                return (
                  <tr
                    key={activeTab === 'pending' ? `p-${item.dispatchNo}-${realIdx}` : `h-${item.dispatchNo}-${realIdx}`}
                    className={`transition-colors ${isSelected ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}
                  >
                    {activeTab === 'pending' && (
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCheckboxToggle(realIdx, item)}
                          className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 font-bold text-gray-900">{item.dispatchNo}</td>
                    <td className="px-6 py-4 text-gray-500 text-center text-xs font-medium">{formatDisplayDate(item.dispatchDate)}</td>
                    {activeTab === 'pending' && <td className="px-6 py-4 text-gray-600 text-xs font-medium">{item.orderNumber}</td>}
                    <td className="px-6 py-4 font-semibold text-gray-800">{item.clientName || item.customer}</td>

                    <td className={`px-6 py-4 text-gray-600 font-medium whitespace-nowrap relative ${isSelected ? 'z-[70]' : ''}`}>
                      {activeTab === 'pending' && isSelected ? (
                        <div className="w-64">
                          <SearchableDropdown
                            value={editData[realIdx]?.product || item.itemName}
                            onChange={(val) => handleEditChange(realIdx, 'product', val)}
                            options={itemNames}
                            placeholder="Select Product"
                            showAll={false}
                            focusColor="primary"
                            className="w-full"
                          />
                        </div>
                      ) : (
                        item.itemName || item.product
                      )}
                    </td>

                    <td className={`px-6 py-4 text-center font-bold text-gray-800 relative ${isSelected ? 'z-[60]' : ''}`}>
                      {activeTab === 'pending' && isSelected ? (
                        <div className="w-40 mx-auto">
                          <SearchableDropdown
                            value={editData[realIdx]?.godown || item.godownName}
                            onChange={(val) => handleEditChange(realIdx, 'godown', val)}
                            options={godowns}
                            placeholder="Select Godown"
                            showAll={false}
                            focusColor="green-800"
                            className="w-full"
                          />
                        </div>
                      ) : (
                        item.godownName || item.godown
                      )}
                    </td>

                    <td className="px-6 py-4 border-l border-gray-50 text-right text-xs font-medium text-gray-700">{item.qty || item.orderQty}</td>

                    <td className="px-6 py-4 border-l border-gray-50 text-right text-xs font-black text-primary bg-primary/5">
                      {activeTab === 'pending' && isSelected ? (
                        <input
                          type="text"
                          value={editData[realIdx]?.dispatchQty || item.dispatchQty}
                          onChange={(e) => handleEditChange(realIdx, 'dispatchQty', e.target.value)}
                          className="w-full px-1 py-0.5 border rounded text-xs outline-none focus:border-primary"
                        />
                      ) : (
                        item.dispatchQty
                      )}
                    </td>

                    {activeTab === 'pending' && (
                      <>
                        <td className={`px-6 py-4 text-center relative ${isSelected ? 'z-[50]' : ''}`}>
                          <input
                            type="date"
                            disabled={!isSelected}
                            value={editData[realIdx]?.completeDate || ''}
                            onChange={(e) => handleEditChange(realIdx, 'completeDate', e.target.value)}
                            className="px-1 py-0.5 border rounded text-xs outline-none focus:border-primary disabled:opacity-50"
                          />
                        </td>
                        <td className={`px-6 py-4 text-center relative ${isSelected ? 'z-[50]' : ''}`}>
                          <div className="relative group">
                            <select
                              disabled={!isSelected}
                              value={editData[realIdx]?.status || 'Completed'}
                              onChange={(e) => handleEditChange(realIdx, 'status', e.target.value)}
                              className={`w-full pl-3 pr-8 py-2 border border-gray-200 rounded text-xs font-semibold appearance-none bg-white transition-all shadow-sm ${
                                isSelected
                                  ? 'cursor-pointer hover:border-primary focus:ring-primary focus:border-transparent outline-none'
                                  : 'bg-gray-50 opacity-70 cursor-not-allowed'
                              }`}
                            >
                              <option value="Completed">Completed</option>
                              <option value="Pending">Pending</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <ChevronDown size={14} />
                            </div>
                          </div>
                        </td>
                      </>
                    )}
                    {activeTab === 'history' && (
                      <>
                        <td className="px-6 py-4 text-gray-500 text-center text-xs font-medium">
                          {formatDisplayDate(item.completeDate)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-green-200 shadow-sm">
                            {item.status}
                          </span>
                        </td>
                      </>
                    )}
                    {activeTab === 'pending' && <td className="px-6 py-4 border-l border-gray-50 text-xs font-medium text-gray-500">{item.crmName}</td>}
                  </tr>
                );
              })}
              {(activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'pending' ? 12 : 9} className="px-4 py-8 text-center text-gray-500 italic">
                    No items found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Scroll hint gradient */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100 to-transparent pointer-events-none opacity-30"></div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200">
          {(activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).map((item) => {
            const realIdx = item.originalIndex;
            const isSelected = activeTab === 'pending' && !!selectedRows[realIdx];
            return (
              <div
                key={activeTab === 'pending' ? `mp-${item.dispatchNo}-${realIdx}` : `mh-${item.dispatchNo}-${realIdx}`}
                className={`p-4 space-y-4 transition-colors ${isSelected ? 'bg-green-50/50' : 'bg-white'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Dispatch No</p>
                    <p className="font-bold text-gray-900 text-sm">{item.dispatchNo}</p>
                  </div>
                  {activeTab === 'pending' && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleCheckboxToggle(realIdx, item)}
                      className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer mt-1"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Customer</p>
                    <p className="font-semibold text-gray-800">{item.clientName || item.customer}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Dispatch Date</p>
                    <p className="text-gray-600">{formatDisplayDate(item.dispatchDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Product</p>
                    {activeTab === 'pending' && isSelected ? (
                      <SearchableDropdown
                        value={editData[realIdx]?.product || item.itemName}
                        onChange={(val) => handleEditChange(realIdx, 'product', val)}
                        options={itemNames}
                        placeholder="Select Product"
                        showAll={false}
                        focusColor="primary"
                        className="w-full"
                      />
                    ) : (
                      <p className="text-gray-700">{item.itemName || item.product}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Godown</p>
                    {activeTab === 'pending' && isSelected ? (
                      <SearchableDropdown
                        value={editData[realIdx]?.godown || item.godownName}
                        onChange={(val) => handleEditChange(realIdx, 'godown', val)}
                        options={godowns}
                        placeholder="Select Godown"
                        showAll={false}
                        focusColor="primary"
                        className="w-full"
                      />
                    ) : (
                      <p className="text-gray-700">{item.godownName || item.godown}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Order Qty</p>
                    <p className="text-gray-700">{item.qty || item.orderQty}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Dispatch Qty</p>
                    {activeTab === 'pending' && isSelected ? (
                      <input
                        type="text"
                        value={editData[realIdx]?.dispatchQty || item.dispatchQty}
                        onChange={(e) => handleEditChange(realIdx, 'dispatchQty', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-xs outline-none focus:border-primary"
                      />
                    ) : (
                      <p className="font-black text-primary">{item.dispatchQty}</p>
                    )}
                  </div>
                  {activeTab === 'pending' && (
                    <>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Complete Date</p>
                        <input
                          type="date"
                          disabled={!isSelected}
                          value={editData[realIdx]?.completeDate || ''}
                          onChange={(e) => handleEditChange(realIdx, 'completeDate', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-xs outline-none focus:border-primary disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Status</p>
                        <div className="relative">
                          <select
                            disabled={!isSelected}
                            value={editData[realIdx]?.status || 'Completed'}
                            onChange={(e) => handleEditChange(realIdx, 'status', e.target.value)}
                            className={`w-full pl-3 pr-8 py-1.5 border border-gray-200 rounded text-xs font-semibold appearance-none bg-white ${
                              isSelected ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <option value="Completed">Completed</option>
                            <option value="Pending">Pending</option>
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <ChevronDown size={12} />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {activeTab === 'history' && (
                    <>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Complete Date</p>
                        <p className="text-gray-600">{formatDisplayDate(item.completeDate)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase mb-0.5">Status</p>
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-green-200">
                          {item.status}
                        </span>
                      </div>
                    </>
                  )}
                  {activeTab === 'pending' && (
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-primary uppercase mb-0.5">CRM Name</p>
                      <p className="text-gray-500">{item.crmName}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {(activeTab === 'pending' ? filteredAndSortedPending : filteredAndSortedHistory).length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500 italic">No items found matching your filters.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DispatchComplete;