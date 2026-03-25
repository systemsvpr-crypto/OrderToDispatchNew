import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle, History, Save, Loader, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import SearchableDropdown from '../../components/SearchableDropdown';
import { useToast } from '../../contexts/ToastContext';
import { useSheets } from '../../contexts/SheetsContext';

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
    const { 
        planning: rawPlanning, 
        dispatchCompleted: rawHistory, 
        itemNames: contextItemNames, 
        godowns: contextGodowns, 
        isLoading, 
        refreshAll 
    } = useSheets();

    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedRows, setSelectedRows] = useState({});
    const [editData, setEditData] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const { showToast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [godownFilter, setGodownFilter] = useState('');

    // Derive pending orders from context
    const orders = useMemo(() => {
        return rawPlanning.slice(3)
            .map((item, idx) => ({
                ...item,
                dispatchNo: getVal(item, 'dispatchNo', 'Dispatch No'),
                dispatchDate: getVal(item, 'dispatchDate', 'Dispatch Date'),
                orderNumber: getVal(item, 'orderNumber', 'orderNo', 'Order No'),
                clientName: getVal(item, 'clientName', 'customer', 'Customer Name', 'Client Name'),
                itemName: getVal(item, 'itemName', 'product', 'Product Name', 'Item Name'),
                godownName: getVal(item, 'godownName', 'godown', 'Godown Name'),
                qty: getVal(item, 'qty', 'orderQty', 'Order Qty'),
                dispatchQty: getVal(item, 'dispatchQty', 'Dispatch Qty'),
                crmName: getVal(item, 'crmName', 'CRM Name'),
                columnO: item.columnO || '',
                columnP: item.columnP || '',
                sheetRow: item.sheetRow || (idx + 4),
                status: String(getVal(item, 'status', 'Status') || '').toLowerCase(),
                originalIndex: idx
            }))
            .filter(item => {
                const colOValue = String(item.columnO || '').trim();
                const colPValue = String(item.columnP || '').trim();
                const bothNotNull = colOValue !== '' && colOValue !== '-' && colPValue !== '' && colPValue !== '-';
                return !bothNotNull;
            });
    }, [rawPlanning]);

    // Derive history from context
    const historyItems = useMemo(() => {
        // Handle mode=table data structure (if headers exist)
        const hasHeaders = rawHistory.length > 0 && Array.isArray(rawHistory[0]) &&
            (String(rawHistory[0][0]).toLowerCase().includes('planning') ||
                String(rawHistory[0][1]).toLowerCase().includes('dispatch'));

        const processArray = hasHeaders ? rawHistory.slice(1) : rawHistory;

        return processArray.map((item, idx) => ({
            ...item,
            dispatchNo: getVal(item, 'dispatchNo', 'Dispatch No'),
            dispatchDate: getVal(item, 'dispatchDate', 'Dispatch Date'),
            completeDate: getVal(item, 'completeDate', 'Complete Date', 'Date'),
            customer: getVal(item, 'customer', 'Customer', 'Customer Name'),
            product: getVal(item, 'product', 'Product', 'Product Name'),
            godown: getVal(item, 'godown', 'Godown Name', 'Godown'),
            orderQty: getVal(item, 'orderQty', 'Order Qty'),
            dispatchQty: getVal(item, 'dispatchQty', 'Dispatch Qty'),
            status: getVal(item, 'status', 'Status'),
            crmName: getVal(item, 'crmName', 'CRM Name'),
            originalIndex: idx
        }));
    }, [rawHistory]);

    // Master data from context
    const itemNames = useMemo(() => {
        const flatItems = contextItemNames.flat().map(v => String(v).trim()).filter(v => v && v.toLowerCase() !== 'product' && v.toLowerCase() !== 'item name');
        return [...new Set(flatItems)].sort();
    }, [contextItemNames]);

    const godowns = useMemo(() => {
        const flatGodowns = contextGodowns.flat().map(v => String(v).trim()).filter(v => v && v.toLowerCase() !== 'godown');
        return [...new Set(flatGodowns)].sort();
    }, [contextGodowns]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // Memoized unique values for filters
    const allUniqueClients = useMemo(() =>
        [...new Set([...orders.map(o => o.clientName), ...historyItems.map(h => h.customer)])].sort(),
        [orders, historyItems]
    );
    const allUniqueGodowns = useMemo(() =>
        [...new Set([...orders.map(o => o.godownName), ...historyItems.map(h => h.godown)])].sort(),
        [orders, historyItems]
    );

    // Memoized sorting logic
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

      {/* Loading / Saving Overlay — first load or save only (background syncs are silent) */}
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

        if (rowsToSubmit.length === 0) return;

        setIsSaving(true);
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    sheet: 'Dispatch Completed',
                    rows: rowsToSubmit,
                    sheetId: import.meta.env.VITE_orderToDispatch_SHEET_ID
                }),
                redirect: 'follow'
            });
            const result = await response.json();
            if (result.success) {
                showToast('Dispatch status updated successfully!', 'success');
                // Global refresh
                await refreshAll(true);
                setSelectedRows({});
                setEditData({});
            } else {
                showToast(`Error saving: ${result.error}`, 'error');
            }
        } catch (error) {
            showToast(`Network error: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }, [selectedRows, orders, editData, refreshAll]);

    // Manual refresh: clear cache and refetch
    const handleRefresh = useCallback(() => {
        refreshAll(true);
    }, [refreshAll]);

    return (
        <div className="p-3 ">
            {/* Header Row with Title, Tabs, Filters, and Actions */}
            <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-100 max-w-[1200px] mx-auto">
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