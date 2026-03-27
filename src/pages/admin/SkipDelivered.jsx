import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Save, Loader, Clock, History, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import SearchableDropdown from '../../components/SearchableDropdown';
import { useToast } from '../../contexts/ToastContext';

// --- Skeleton Components ---
const TableSkeleton = ({ cols }) => (
  <>
    {[...Array(6)].map((_, i) => (
      <tr key={i} className="border-b border-gray-100 last:border-0">
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
      <div key={i} className="p-4 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2 w-2/3">
            <div className="h-3 w-1/3 bg-gray-100 rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
            </div>
            <div className="h-5 w-full bg-gray-100 rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
            </div>
          </div>
          <div className="h-6 w-16 bg-gray-100 rounded-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
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

const SkipDelivered = () => {
  const [pendingItems, setPendingItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});
  const [editData, setEditData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [godownFilter, setGodownFilter] = useState('');
  const { showToast } = useToast();

  const API_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;
  const MASTER_URL = import.meta.env.VITE_MASTER_URL;
  const SHEET_ID = import.meta.env.VITE_orderToDispatch_SHEET_ID;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const abortControllerRef = useRef(null);

  const [godowns, setGodowns] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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

  // Format date for display (e.g., 25-Feb-2026)
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

  // Format date for input value (YYYY-MM-DD)
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  };

  // --- Unified fetch: ORDER + Skip sheets + Godowns ---
  const fetchAllData = useCallback(async (isRefresh = false) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const MIN_DISPLAY_MS = 1500;
    const minTimer = new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_MS));

    const doFetch = async () => {
      // Fetch ORDER, Skip, and Godowns in parallel
      const [orderRes, skipRes, godownRes] = await Promise.all([
        fetch(`${API_URL}?sheet=ORDER&mode=table${SHEET_ID ? `&sheetId=${SHEET_ID}` : ''}`, { signal: controller.signal }),
        fetch(`${API_URL}?sheet=Skip&mode=table${SHEET_ID ? `&sheetId=${SHEET_ID}` : ''}`, { signal: controller.signal }),
        MASTER_URL ? fetch(`${MASTER_URL}?sheet=Products&col=4`, { signal: controller.signal }) : Promise.resolve(null)
      ]);

      const [orderResult, skipResult, godownResult] = await Promise.all([
        orderRes.json(),
        skipRes.json(),
        godownRes ? godownRes.json() : Promise.resolve(null)
      ]);

      // Map ORDER → pending items
      let pending = [];
      if (orderResult.success && Array.isArray(orderResult.data)) {
        pending = orderResult.data.slice(5).filter(item => {
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
      }

      // Map Skip → history items
      let history = [];
      if (skipResult.success && Array.isArray(skipResult.data)) {
        history = skipResult.data.slice(1)
          .filter(row => row && getVal(row, 'orderNumber', 0))
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
      }

      // Map Godowns
      let godownList = [];
      if (godownResult?.success && Array.isArray(godownResult.data)) {
        godownList = godownResult.data.sort();
      }

      return { pending, history, godownList };
    };

    try {
      const [result] = await Promise.all([doFetch(), minTimer]);
      if (!controller.signal.aborted) {
        setPendingItems(result.pending);
        setHistoryItems(result.history);
        if (result.godownList.length > 0) setGodowns(result.godownList);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('fetchAllData error:', error);
        showToast('Failed to load data: ' + error.message, 'error');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [API_URL, SHEET_ID, MASTER_URL, showToast]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchAllData();
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, [fetchAllData]);

  // Clear selection/edit data on tab switch
  useEffect(() => {
    setSelectedRows({});
    setEditData({});
  }, [activeTab]);

  // --- Manual refresh ---
  const handleRefresh = useCallback(() => {
    fetchAllData(true);
  }, [fetchAllData]);

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


  // Checkbox toggle
  const handleCheckboxToggle = (originalIdx) => {
    setSelectedRows(prev => {
      const newState = { ...prev };
      const isNowSelected = !newState[originalIdx];
      if (isNowSelected) {
        newState[originalIdx] = true;
      } else {
        delete newState[originalIdx];
      }
      return newState;
    });

    // Use functional update for editData as well to ensure it's in sync
    setEditData(prev => {
      const newState = { ...prev };
      const isNowSelected = !selectedRows[originalIdx]; // Note: this might be slightly risky if called multiple times rapidly, but standard for this pattern
      if (isNowSelected) {
        const item = pendingItems.find(it => it.originalIndex === originalIdx);
        newState[originalIdx] = {
          dispatchQty: '',
          dispatchDate: new Date().toISOString().split('T')[0],
          gstIncluded: 'No',
          godown: item?.godown || ''
        };
      } else {
        delete newState[originalIdx];
      }
      return newState;
    });
  };

  // Toggle Select All for filtered items
  const toggleSelectAll = () => {
    const allFilteredIndices = filteredItems.map(item => item.originalIndex);
    const allAreCurrentlySelected = allFilteredIndices.length > 0 && allFilteredIndices.every(idx => selectedRows[idx]);

    if (allAreCurrentlySelected) {
      // Uncheck all filtered
      setSelectedRows(prev => {
        const next = { ...prev };
        allFilteredIndices.forEach(idx => delete next[idx]);
        return next;
      });
      setEditData(prev => {
        const next = { ...prev };
        allFilteredIndices.forEach(idx => delete next[idx]);
        return next;
      });
    } else {
      // Check all filtered
      const today = new Date().toISOString().split('T')[0];
      setSelectedRows(prev => {
        const next = { ...prev };
        allFilteredIndices.forEach(idx => { next[idx] = true; });
        return next;
      });
      setEditData(prev => {
        const next = { ...prev };
        allFilteredIndices.forEach(idx => {
          if (!next[idx]) {
            const item = pendingItems.find(it => it.originalIndex === idx);
            next[idx] = {
              dispatchQty: '',
              dispatchDate: today,
              gstIncluded: 'No',
              godown: item?.godown || ''
            };
          }
        });
        return next;
      });
    }
  };

  const selectedCount = Object.values(selectedRows).filter(Boolean).length;
  const isAllFilteredSelected = filteredItems.length > 0 && filteredItems.every(item => selectedRows[item.originalIndex]);

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

    if (!window.confirm(`Are you sure you want to mark ${selectedItems.length} items as skipped?`)) {
      return;
    }

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

      // On success, refresh data
      fetchAllData(true);
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
      <div className="flex flex-col gap-4 mb-6 bg-white p-4 lg:p-5 rounded shadow-sm border border-gray-100 max-w-[1200px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Skip Delivered</h1>

            <div className="flex bg-gray-100 p-1 rounded">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
              >
                <Clock size={16} />
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
              placeholder="Search..."
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
            {/* Refresh button */}
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

            {activeTab === 'pending' && (
              <button
                onClick={handleSave}
                disabled={isSaving || selectedCount === 0}
                className={`flex items-center justify-center gap-2 px-5 h-[42px] rounded shadow-md font-bold text-sm transition-all flex-1 sm:flex-none ml-auto sm:ml-0 ${selectedCount > 0
                  ? 'bg-primary text-white hover:bg-primary-hover shadow-primary/20'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200'
                  }`}
              >
                {isSaving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? 'Saving...' : selectedCount > 0 ? `Mark ${selectedCount} Skipped` : 'Mark Skipped'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Saving overlay - only for save action */}
      {isSaving && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/40 backdrop-blur-md">
          <div className="bg-white/80 p-10 rounded-3xl shadow-xl flex flex-col items-center gap-4 border border-white/50">
            <Loader className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-black text-gray-700 uppercase tracking-widest">Processing Skip...</p>
          </div>
        </div>
      )}

      {/* Refresh progress bar */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 h-1 z-[101] bg-gray-100 overflow-hidden">
          <div className="h-full bg-primary animate-shimmer" style={{ width: '40%' }}></div>
        </div>
      )}

      {/* Data table */}
      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden max-w-[1200px] mx-auto">
        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 max-h-[460px] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold sticky top-0 z-10 shadow-sm">
                {activeTab === 'pending' && (
                  <th className="px-6 py-4 text-center w-16">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400">All</span>
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={toggleSelectAll}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </div>
                  </th>
                )}
                {activeTab === 'pending' && (
                  <>
                    <th className="px-6 py-4 text-primary-hover text-right whitespace-nowrap">Dispatch Qty</th>
                    <th className="px-6 py-4 text-primary-hover text-center whitespace-nowrap">Dispatch Date</th>
                    <th className="px-6 py-4 text-primary-hover text-center whitespace-nowrap">GST Inc.</th>
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
              {loading ? (
                <TableSkeleton cols={activeTab === 'pending' ? 15 : 10} />
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'pending' ? 15 : 10} className="px-6 py-20 text-center text-gray-400 italic text-sm font-bold">
                    No items found.
                  </td>
                </tr>
              ) : null}
              {!loading && filteredItems.map((item, idx) => {
                const originalIdx = item.originalIndex ?? idx;
                const uniqueKey = `${activeTab}-${item.orderNumber}-${item.itemName}-${originalIdx}`;
                const isSelected = activeTab === 'pending' && !!selectedRows[originalIdx];
                const edit = editData[originalIdx] || {};
                return (
                  <tr key={uniqueKey} className={isSelected ? 'bg-green-50/50' : 'hover:bg-gray-50'}>
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
                    {/* Extra columns: now always rendered for pending but conditionally editable */}
                    {activeTab === 'pending' && (
                      <>
                        <td className="px-6 py-4 text-right">
                          {isSelected ? (
                            <input
                              type="number"
                              value={edit.dispatchQty || ''}
                              onChange={(e) => handleEditChange(originalIdx, 'dispatchQty', e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary focus:border-primary outline-none text-right"
                              placeholder="Qty"
                            />
                          ) : (
                            <span className="text-gray-300 italic text-[10px]">Select to edit</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isSelected ? (
                            <input
                              type="date"
                              value={formatDateForInput(edit.dispatchDate) || ''}
                              onChange={(e) => handleEditChange(originalIdx, 'dispatchDate', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary focus:border-primary outline-none"
                            />
                          ) : (
                            <span className="text-gray-300 italic text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isSelected ? (
                            <div className="relative inline-block w-20">
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
                            <span className="text-gray-300 italic text-[10px]">-</span>
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

            </tbody>
          </table>
        </div>

        {/* Mobile card view */}
        {loading && <MobileSkeleton />}
        <div className="md:hidden divide-y divide-gray-200">
          {activeTab === 'pending' && filteredItems.length > 0 && (
            <div className="p-4 bg-gray-50 flex justify-between items-center border-b border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase">Select All Filtered</span>
              <input
                type="checkbox"
                checked={isAllFilteredSelected}
                onChange={toggleSelectAll}
                className="rounded text-primary focus:ring-primary w-6 h-6 cursor-pointer"
              />
            </div>
          )}
          {filteredItems.map((item, idx) => {
            const originalIdx = item.originalIndex ?? idx;
            const uniqueKey = `${activeTab}-${item.orderNumber}-${item.itemName}-${originalIdx}`;
            const isSelected = activeTab === 'pending' && !!selectedRows[originalIdx];
            const edit = editData[originalIdx] || {};
            return (
              <div key={uniqueKey} className={`p-4 space-y-3 ${isSelected ? 'bg-green-50/30' : 'bg-white'}`}>
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
