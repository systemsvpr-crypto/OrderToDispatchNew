import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Save, History, ClipboardList, X, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import SearchableDropdown from '../../components/SearchableDropdown';
import { useToast } from '../../contexts/ToastContext';
import { useSheets } from '../../contexts/SheetsContext';

const GODOWNS = ['Godown 1', 'Godown 2', 'Main Store', 'North Warehouse'];

const API_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;
const SHEET_ID = import.meta.env.VITE_orderToDispatch_SHEET_ID;

// Helper to get value from object (unchanged)
const getVal = (obj, ...possibleKeys) => {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of possibleKeys) {
    if (typeof key === 'number') {
      const vals = Object.values(obj);
      if (vals[key] !== undefined) return vals[key];
    } else if (obj[key] !== undefined) {
      return obj[key];
    }
  }
  return null;
};

// Professional Date Formatter (unchanged)
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '-';
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

const DispatchPlanning = () => {
    const { 
        orders: rawOrders, 
        planning: rawPlanning, 
        isLoading, 
        refreshAll 
    } = useSheets();

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

    const [activeTab, setActiveTab] = useState('pending');
    const [selectedRows, setSelectedRows] = useState({});
    const [editData, setEditData] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const { showToast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [godownFilter, setGodownFilter] = useState('');
    const [orderNoFilter, setOrderNoFilter] = useState('');
    const [itemFilter, setItemFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [stockLocationFilter, setStockLocationFilter] = useState('');

    // Derivative state: Pending Orders from global 'ORDER' data
    const orders = useMemo(() => {
        const mappedData = rawOrders.slice(5).map((item, index) => ({
            ...item,
            originalIndex: index,
            orderNo: item.orderNumber,
            qty: item.qty || 0
        }));

        // Filter: Column Q is not null AND Column R is null AND Remaining Planning Qty > 0
        return mappedData.filter(item => {
            const hasQ = item.columnQ !== undefined && item.columnQ !== null && String(item.columnQ).trim() !== '';
            const hasR = item.columnR !== undefined && item.columnR !== null && String(item.columnR).trim() !== '';

            const pendingQty = parseFloat(String(getVal(item, 'planningPendingQty', 11) || '0').replace(/[^0-9.-]+/g, ''));
            // Only show planned, un-finished items with positive pending quantity
            return hasQ && !hasR && !isNaN(pendingQty) && pendingQty > 0;
        });
    }, [rawOrders]);

    // Derivative state: History from global 'Planning' data
    const dispatchHistory = useMemo(() => {
        return rawPlanning.slice(3).map(item => ({
            ...item,
            orderNo: item.orderNumber || item.orderNo
        }));
    }, [rawPlanning]);

    // Independent UI State Management - Clear selection/edit data on tab switch
    useEffect(() => {
        setSelectedRows({});
        setEditData({});
    }, [activeTab]);

    // Ensure data is loaded on mount
    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // Get unique values for filters - Memoized
    const allUniqueClients = useMemo(() => [...new Set([...orders.map(o => o.clientName), ...dispatchHistory.map(h => h.clientName)])].sort(), [orders, dispatchHistory]);
    const allUniqueGodowns = useMemo(() => [...new Set([...orders.map(o => o.godownName), ...dispatchHistory.map(h => h.godownName)])].sort(), [orders, dispatchHistory]);
    const allUniqueOrderNos = useMemo(() => [...new Set([...orders.map(o => o.orderNo), ...dispatchHistory.map(h => h.orderNo)])].sort(), [orders, dispatchHistory]);
    const allUniqueItems = useMemo(() => [...new Set([...orders.map(o => o.itemName), ...dispatchHistory.map(h => h.itemName)])].sort(), [orders, dispatchHistory]);
    const allUniqueDates = useMemo(() => {
        const rawDates = [...new Set([
            ...orders.map(o => o.orderDate),
            ...dispatchHistory.map(h => h.orderDate)
        ])].filter(Boolean).sort((a, b) => new Date(b) - new Date(a));
        return rawDates.map(d => formatDisplayDate(d));
    }, [orders, dispatchHistory]);
    const allUniqueStockLocs = useMemo(() => {
        const locations = new Set();
        orders.forEach(order => {
            if (order.currentStock) {
                order.currentStock.split(',').forEach(part => {
                    const loc = part.split(':')[0].trim();
                    if (loc) locations.add(loc);
                });
            }
        });
      }
    });
    return [...locations].sort();
  }, [orders]);

  // Sorting logic (unchanged)
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

  const filteredAndSortedOrders = useMemo(() => {
    if (!orders) return [];
    const filtered = orders.filter(order => {
      const matchesSearch = Object.values(order).some(val =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesClient = clientFilter === '' || order.clientName === clientFilter;
      const matchesGodown = godownFilter === '' || order.godownName === godownFilter;
      const matchesOrderNo = orderNoFilter === '' || order.orderNo === orderNoFilter;
      const matchesItem = itemFilter === '' || order.itemName === itemFilter;
      const matchesDate = dateFilter === '' || formatDisplayDate(order.orderDate) === dateFilter;
      const stockData = String(order.currentStock || '');
      const matchesStockLocation = stockLocationFilter === '' || stockData.toLowerCase().includes(stockLocationFilter.toLowerCase());

      return matchesSearch && matchesClient && matchesGodown && matchesOrderNo && matchesItem && matchesDate && matchesStockLocation;
    });
    return getSortedItems(filtered);
  }, [orders, searchTerm, clientFilter, godownFilter, orderNoFilter, itemFilter, dateFilter, stockLocationFilter, getSortedItems]);

  const filteredAndSortedHistory = useMemo(() => {
    if (!dispatchHistory) return [];
    const filtered = dispatchHistory.filter(item => {
      const matchesSearch = Object.values(item).some(val =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesClient = clientFilter === '' || item.clientName === clientFilter;
      const matchesGodown = godownFilter === '' || item.godownName === godownFilter;
      const matchesOrderNo = orderNoFilter === '' || item.orderNo === orderNoFilter;
      const matchesItem = itemFilter === '' || item.itemName === itemFilter;
      const matchesDate = dateFilter === '' || formatDisplayDate(item.orderDate) === dateFilter;
      return matchesSearch && matchesClient && matchesGodown && matchesOrderNo && matchesItem && matchesDate;
    });
    return getSortedItems(filtered);
  }, [dispatchHistory, searchTerm, clientFilter, godownFilter, orderNoFilter, itemFilter, dateFilter, getSortedItems]);

  // Handlers (unchanged)
  const handleCheckboxToggle = useCallback((idx, order) => {
    setSelectedRows(prev => {
      const isSelected = !prev[idx];
      const next = { ...prev, [idx]: isSelected };
      if (isSelected) {
        setEditData(prevEdit => ({
          ...prevEdit,
          [idx]: {
            dispatchQty: order.qty,
            dispatchDate: new Date().toISOString().split('T')[0],
            gstIncluded: 'Yes',
            godownName: order.godownName
          }
        }));
      } else {
        setEditData(prevEdit => {
          const newEditData = { ...prevEdit };
          delete newEditData[idx];
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

    Object.keys(selectedRows).forEach((idx) => {
      if (selectedRows[idx]) {
        const order = orders?.find(o => String(o.originalIndex) === String(idx));
        const planningData = editData[idx];
        if (order && planningData) {
          rowsToSubmit.push({
            ...order,
            dispatchQty: planningData.dispatchQty,
            dispatchDate: planningData.dispatchDate,
            gstIncluded: planningData.gstIncluded,
            godownName: planningData.godownName || order.godownName
          });
        }
      }
    });

    if (rowsToSubmit.length === 0) return;

        if (rowsToSubmit.length === 0) return;

        setIsLoading(true);
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    sheetId: import.meta.env.VITE_orderToDispatch_SHEET_ID,
                    sheet: "Planning",
                    rows: rowsToSubmit
                })
            });

            const result = await response.json();
            if (result.success) {
                showToast('Planning saved successfully!', 'success');
                // Refresh global state
                await refreshAll(true);
                setSelectedRows({});
                setEditData({});
            } else {
                showToast(`Error saving: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Save failed:', error);
            showToast(`Failed to save planning: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedRows, orders, editData, refreshAll]);

    // Manual refresh: trigger global reload
    const handleRefresh = useCallback(() => {
        refreshAll(true);
    }, [refreshAll]);

    const clearFilters = useCallback(() => {
        setSearchTerm('');
        setClientFilter('');
        setGodownFilter('');
        setOrderNoFilter('');
        setItemFilter('');
        setDateFilter('');
        setStockLocationFilter('');
    }, []);

    const handleCancelSelection = useCallback(() => {
        setSelectedRows({});
        setEditData({});
      } else {
        showToast(`Error saving: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Save failed:', error);
      showToast(`Failed to save planning: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [selectedRows, orders, editData, refreshOrders, refreshHistory, showToast, API_URL, SHEET_ID]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    sessionStorage.removeItem('dispatchPlanningOrders');
    sessionStorage.removeItem('dispatchPlanningHistory');
    refreshOrders();
    refreshHistory();
  }, [refreshOrders, refreshHistory]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setClientFilter('');
    setGodownFilter('');
    setOrderNoFilter('');
    setItemFilter('');
    setDateFilter('');
    setStockLocationFilter('');
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectedRows({});
    setEditData({});
  }, []);

  const isAnySelected = Object.values(selectedRows).some(Boolean);

  return (
    <div className="">
      {/* Header Row with Title, Tabs, Filters, and Actions */}
      <div className="flex flex-col gap-4 mb-6 bg-white p-4 lg:p-5 rounded shadow-sm border border-white/50 max-w-[1200px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Dispatch Planning</h1>

            <div className="flex bg-gray-100 p-1 rounded">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <ClipboardList size={16} />
                Pending
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <History size={16} />
                History
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs font-bold border border-gray-200 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            {(searchTerm || clientFilter || godownFilter || orderNoFilter || itemFilter || dateFilter || stockLocationFilter) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-primary rounded hover:bg-green-100 transition-colors text-xs font-bold border border-green-100"
              >
                <X size={14} />
                Clear Filters
              </button>
            )}

            {activeTab === 'pending' && Object.values(selectedRows).some(v => v) && (
              <div className="flex items-center gap-2 sm:border-l sm:border-gray-200 sm:pl-3">
                <button
                  onClick={handleCancelSelection}
                  className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded hover:bg-gray-50 transition-colors font-bold text-[13px] border border-gray-200"
                >
                  <X size={14} />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded hover:bg-primary-hover shadow-md font-bold text-[13px]"
                >
                  <Save size={14} />
                  Save
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded focus:ring-primary focus:border-primary"
          />
          <SearchableDropdown
            value={clientFilter}
            onChange={setClientFilter}
            options={allUniqueClients}
            allLabel="All Clients"
            className="w-full"
          />
          <SearchableDropdown
            value={godownFilter}
            onChange={setGodownFilter}
            options={allUniqueGodowns}
            allLabel="All Godowns"
            className="w-full"
          />
          <SearchableDropdown
            value={orderNoFilter}
            onChange={setOrderNoFilter}
            options={allUniqueOrderNos}
            allLabel="All Order No"
            className="w-full"
            focusColor="primary"
          />
          <SearchableDropdown
            value={itemFilter}
            onChange={setItemFilter}
            options={allUniqueItems}
            allLabel="All Items"
            className="w-full"
            focusColor="primary"
          />
          <SearchableDropdown
            value={dateFilter}
            onChange={setDateFilter}
            options={allUniqueDates}
            allLabel="All Dates"
            className="w-full"
            focusColor="primary"
          />
          <SearchableDropdown
            value={stockLocationFilter}
            onChange={setStockLocationFilter}
            options={allUniqueStockLocs}
            allLabel="Stock Loc"
            className="w-full"
            focusColor="primary"
          />
        </div>
      </div>

      {/* Loading Overlay — first load only (background syncs are silent) */}
      {isLoading && (
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
                Loading
                <span className="inline-flex ml-1">
                  <span className="animate-bounce" style={{ animationDelay: '0s' }}>.</span>
                  <span className="animate-bounce [animation-delay:0.2s] ml-0.5">.</span>
                  <span className="animate-bounce [animation-delay:0.4s] ml-0.5">.</span>
                </span>
              </h3>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider bg-gray-50 px-3 py-1 rounded-full border border-gray-100 shadow-inner">
                Fetching Planning Data
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 overflow-hidden max-w-[1200px] mx-auto">
        {activeTab === 'pending' ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block relative overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[1400px] mx-0">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold sticky top-0 z-10 shadow-sm">
                    <th className="px-6 py-4 text-center">Action</th>
                    {isAnySelected && (
                      <>
                        <th className="px-6 py-4 animate-column text-right">Dispatch Qty</th>
                        <th className="px-6 py-4 animate-column text-center">Dispatch Date</th>
                        <th className="px-6 py-4 animate-column text-center">GST</th>
                        <th className="px-6 py-4 animate-column text-center">Dispatch Godown</th>
                      </>
                    )}
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('orderNo')}>
                      <div className="flex items-center gap-1">Order No <SortIcon column="orderNo" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 text-center" onClick={() => requestSort('orderDate')}>
                      <div className="flex items-center gap-1 justify-center">Order Date <SortIcon column="orderDate" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('clientName')}>
                      <div className="flex items-center gap-1">Client Name <SortIcon column="clientName" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 text-center" onClick={() => requestSort('godownName')}>
                      <div className="flex items-center gap-1 justify-center">Godown <SortIcon column="godownName" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('itemName')}>
                      <div className="flex items-center gap-1">Item Name <SortIcon column="itemName" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('rate')}>
                      <div className="flex items-center gap-1 justify-end">Rate <SortIcon column="rate" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('qty')}>
                      <div className="flex items-center gap-1 justify-end">Order Qty <SortIcon column="qty" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('currentStock')}>
                      <div className="flex items-center gap-1 justify-end">Current Stock <SortIcon column="currentStock" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('intransitQty')}>
                      <div className="flex items-center gap-1 justify-end">Intransit Qty <SortIcon column="intransitQty" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('planningQty')}>
                      <div className="flex items-center gap-1 justify-end">Planning Qty <SortIcon column="planningQty" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('planningPendingQty')}>
                      <div className="flex items-center gap-1 justify-end">Remaining Planing Qty <SortIcon column="planningPendingQty" sortConfig={sortConfig} /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('qtyDelivered')}>
                      <div className="flex items-center gap-1 justify-end">Qty Delivered <SortIcon column="qtyDelivered" sortConfig={sortConfig} /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {filteredAndSortedOrders.map((order) => {
                    const realIdx = order.originalIndex;
                    return (
                      <tr key={`${order.orderNo}-${realIdx}`} className={`${selectedRows[realIdx] ? 'bg-green-50/50' : 'hover:bg-gray-50'} transition-colors`}>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={!!selectedRows[realIdx]}
                            onChange={() => handleCheckboxToggle(realIdx, order)}
                            className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                          />
                        </td>
                        {isAnySelected && (
                          <>
                            <td className="px-6 py-4 animate-column text-right">
                              {selectedRows[realIdx] ? (
                                <input
                                  type="number"
                                  value={editData[realIdx]?.dispatchQty || ''}
                                  onChange={(e) => handleEditChange(realIdx, 'dispatchQty', e.target.value)}
                                  className="w-20 px-2 py-1 border rounded text-xs outline-none focus:border-primary text-right"
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 animate-column text-center">
                              {selectedRows[realIdx] ? (
                                <input
                                  type="date"
                                  value={editData[realIdx]?.dispatchDate || ''}
                                  onChange={(e) => handleEditChange(realIdx, 'dispatchDate', e.target.value)}
                                  className="px-2 py-1 border rounded text-xs outline-none focus:border-primary"
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 animate-column text-center">
                              {selectedRows[realIdx] ? (
                                <select
                                  value={editData[realIdx]?.gstIncluded || ''}
                                  onChange={(e) => handleEditChange(realIdx, 'gstIncluded', e.target.value)}
                                  className="px-2 py-1 border rounded text-xs outline-none focus:border-primary"
                                >
                                  <option value="Yes">Yes</option>
                                  <option value="No">No</option>
                                </select>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 animate-column text-center">
                              {selectedRows[realIdx] ? (
                                <select
                                  value={editData[realIdx]?.godownName || order.godownName}
                                  onChange={(e) => handleEditChange(realIdx, 'godownName', e.target.value)}
                                  className="px-2 py-1 border rounded text-xs outline-none focus:border-primary w-full"
                                >
                                  {[...new Set([...GODOWNS, order.godownName])].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="px-6 py-4">{order.orderNo}</td>
                        <td className="px-6 py-4 text-center">{formatDisplayDate(order.orderDate)}</td>
                        <td className="px-6 py-4">{order.clientName}</td>
                        <td className="px-6 py-4 text-center">{order.godownName}</td>
                        <td className="px-6 py-4">{order.itemName}</td>
                        <td className="px-6 py-4 text-right">{order.rate}</td>
                        <td className="px-6 py-4 text-right font-bold text-primary">{order.qty}</td>
                        <td className="px-6 py-4 text-right text-xs font-medium text-gray-700">{order.currentStock || '-'}</td>
                        <td className="px-6 py-4 text-right font-medium text-gray-700">{order.intransitQty || '0'}</td>
                        <td className="px-6 py-4 text-right font-medium text-gray-700">{order.planningQty || '0'}</td>
                        <td className="px-6 py-4 text-right font-medium text-gray-700">{order.planningPendingQty || '0'}</td>
                        <td className="px-6 py-4 text-right font-medium text-gray-700">{order.qtyDelivered || '0'}</td>
                      </tr>
                    );
                  })}
                  {filteredAndSortedOrders.length === 0 && (
                    <tr>
                      <td colSpan={isAnySelected ? 17 : 13} className="px-4 py-8 text-center text-gray-500 italic">No items found matching your filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {/* Scroll hint gradient (optional) */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100 to-transparent pointer-events-none opacity-30"></div>
            </div>

            {/* Mobile Card View (unchanged) */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredAndSortedOrders.map((order) => {
                const realIdx = order.originalIndex;
                return (
                  <div key={`${order.orderNo}-${realIdx}`} className={`p-4 space-y-4 ${selectedRows[realIdx] ? 'bg-green-50/30' : 'bg-white'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={!!selectedRows[realIdx]}
                          onChange={() => handleCheckboxToggle(realIdx, order)}
                          className="mt-1 rounded text-primary focus:ring-primary w-5 h-5"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{order.clientName}</h4>
                          <p className="text-[10px] mt-1 text-gray-500">Order: {order.orderNo} | {order.itemName}</p>
                        </div>
                      </div>
                    </div>

                    {selectedRows[realIdx] && (
                      <div className="grid grid-cols-2 gap-3 bg-green-50/50 p-3 rounded border border-green-100">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-primary mb-1 uppercase">Dispatch Date</label>
                          <input
                            type="date"
                            value={editData[realIdx]?.dispatchDate || ''}
                            onChange={(e) => handleEditChange(realIdx, 'dispatchDate', e.target.value)}
                            className="w-full px-3 py-1.5 border border-green-200 rounded text-xs outline-none focus:border-primary bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-primary mb-1 uppercase">Disp Qty</label>
                          <input
                            type="number"
                            value={editData[realIdx]?.dispatchQty || ''}
                            onChange={(e) => handleEditChange(realIdx, 'dispatchQty', e.target.value)}
                            className="w-full px-3 py-1.5 border border-green-200 rounded text-xs outline-none focus:border-primary bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-primary mb-1 uppercase">GST</label>
                          <select
                            value={editData[realIdx]?.gstIncluded || ''}
                            onChange={(e) => handleEditChange(realIdx, 'gstIncluded', e.target.value)}
                            className="w-full px-3 py-1.5 border border-green-200 rounded text-xs outline-none focus:border-primary bg-white"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-primary mb-1 uppercase">Godown Name</label>
                          <select
                            value={editData[realIdx]?.godownName || order.godownName}
                            onChange={(e) => handleEditChange(realIdx, 'godownName', e.target.value)}
                            className="w-full px-3 py-1.5 border border-green-200 rounded text-xs outline-none focus:border-primary bg-white"
                          >
                            {[...new Set([...GODOWNS, order.godownName])].map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-2 text-[10px] text-gray-500 pt-2 border-t border-gray-50">
                      <div>
                        <p className="uppercase text-[8px] font-bold text-gray-400">Rate</p>
                        <p className="font-bold text-gray-700">{order.rate}</p>
                      </div>
                      <div>
                        <p className="uppercase text-[8px] font-bold text-gray-400">Order Qty</p>
                        <p className="font-bold text-primary">{order.qty}</p>
                      </div>
                      <div>
                        <p className="uppercase text-[8px] font-bold text-gray-400">Godown</p>
                        <p className="font-bold text-gray-700 truncate">{order.godownName}</p>
                      </div>
                      <div className="bg-gray-50 p-1 rounded border border-gray-100">
                        <p className="uppercase text-[8px] font-bold text-gray-400">Stock</p>
                        <p className="font-bold text-gray-700 leading-tight">{order.currentStock || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-1 rounded border border-gray-100">
                        <p className="uppercase text-[8px] font-bold text-gray-400">Intransit</p>
                        <p className="font-bold text-gray-700">{order.intransitQty || '0'}</p>
                      </div>
                      <div className="bg-gray-50 p-1 rounded border border-gray-100">
                        <p className="uppercase text-[8px] font-bold text-gray-400">Plan Qty</p>
                        <p className="font-bold text-gray-700">{order.planningQty || '0'}</p>
                      </div>
                      <div className="bg-gray-50 p-1 rounded border border-gray-100">
                        <p className="uppercase text-[8px] font-bold text-gray-400">Plan Pend</p>
                        <p className="font-bold text-gray-700">{order.planningPendingQty || '0'}</p>
                      </div>
                      <div className="bg-gray-50 p-1 rounded border border-gray-100">
                        <p className="uppercase text-[8px] font-bold text-gray-400">Delivered</p>
                        <p className="font-bold text-gray-700">{order.qtyDelivered || '0'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredAndSortedOrders.length === 0 && (
                <div className="p-8 text-center text-gray-500 italic text-sm">No items found matching your filters.</div>
              )}
            </div>
          </>
        ) : (
          // History tab
          <>
            <div className="hidden md:block relative overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[1200px] mx-0">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold sticky top-0 z-10 shadow-sm">
                    {[
                      { label: 'Order No', key: 'orderNo' },
                      { label: 'Dispatch No', key: 'dispatchNo' },
                      { label: 'Disp Qty', key: 'dispatchQty', align: 'right' },
                      { label: 'Disp Date', key: 'dispatchDate', align: 'center' },
                      { label: 'GST', key: 'gstIncluded', align: 'center' },
                      { label: 'Client', key: 'clientName' },
                      { label: 'Godown', key: 'godownName', align: 'center' },
                      { label: 'Order Date', key: 'orderDate', align: 'center' },
                      { label: 'Item Name', key: 'itemName' },
                      { label: 'Rate', key: 'rate', align: 'right' },
                      { label: 'Qty', key: 'qty', align: 'right' }
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                        onClick={() => requestSort(col.key)}
                      >
                        <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                          {col.label}
                          <SortIcon column={col.key} sortConfig={sortConfig} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm italic">
                  {filteredAndSortedHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">{item.orderNo}</td>
                      <td className="px-6 py-4 font-bold text-primary">{item.dispatchNo}</td>
                      <td className="px-6 py-4 font-semibold text-right">{item.dispatchQty}</td>
                      <td className="px-6 py-4 text-center">{formatDisplayDate(item.dispatchDate)}</td>
                      <td className="px-6 py-4 text-center">{item.gstIncluded}</td>
                      <td className="px-6 py-4">{item.clientName}</td>
                      <td className="px-6 py-4 text-center">{item.godownName}</td>
                      <td className="px-6 py-4 text-center">{formatDisplayDate(item.orderDate)}</td>
                      <td className="px-6 py-4">{item.itemName}</td>
                      <td className="px-6 py-4 text-right">{item.rate}</td>
                      <td className="px-6 py-4 text-right font-bold">{item.qty}</td>
                    </tr>
                  ))}
                  {filteredAndSortedHistory.length === 0 && (
                    <tr><td colSpan="11" className="px-4 py-8 text-center text-gray-500">No planning history found.</td></tr>
                  )}
                </tbody>
              </table>
              {/* Scroll hint gradient (optional) */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100 to-transparent pointer-events-none opacity-30"></div>
            </div>
            <div className="md:hidden divide-y divide-gray-200">
              {filteredAndSortedHistory.map((item, idx) => (
                <div key={idx} className="p-4 space-y-3 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase leading-none mb-1">{item.dispatchNo}</p>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">{item.clientName}</h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] text-gray-600">
                    <div className="flex justify-between border-b border-gray-50 pb-1">
                      <span className="text-gray-400">Order No</span>
                      <span className="font-medium">{item.orderNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-1">
                      <span className="text-gray-400">Disp Qty</span>
                      <span className="font-bold text-primary">{item.dispatchQty}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-1">
                      <span className="text-gray-400">Disp Date</span>
                      <span className="font-medium">{formatDisplayDate(item.dispatchDate)}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-1">
                      <span className="text-gray-400">GST</span>
                      <span className="font-medium">{item.gstIncluded}</span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-400 mb-0.5">Item Details</p>
                      <p className="font-bold text-gray-800 uppercase">{item.itemName} @ {item.rate}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredAndSortedHistory.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm italic">History is empty.</div>
              )}
            </div>
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-10px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .animate-column {
            animation: fadeIn 0.3s ease-out forwards;
          }
        `}}
      />
    </div>
  );
};

// Helper component for sort icons
const SortIcon = ({ column, sortConfig }) => (
  <div className="flex flex-col">
    <ChevronUp size={10} className={sortConfig.key === column && sortConfig.direction === 'asc' ? 'text-primary' : 'text-gray-300'} />
    <ChevronDown size={10} className={sortConfig.key === column && sortConfig.direction === 'desc' ? 'text-primary' : 'text-gray-300'} />
  </div>
);

export default DispatchPlanning;