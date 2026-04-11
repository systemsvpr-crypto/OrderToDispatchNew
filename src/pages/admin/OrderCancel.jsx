import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { XCircle, RefreshCcw, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../supabaseClient';

const OrderCancel = () => {
    const [canceledItems, setCanceledItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { showToast } = useToast();
    const [sortConfig, setSortConfig] = useState({ key: 'cancelDate', direction: 'desc' });

    const formatDisplayDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const day = date.getDate().toString().padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
        } catch { return dateStr; }
    };

    const fetchCanceledData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const { data, error } = await supabase
                .from('dispatch_plans')
                .select(`
                    *,
                    order:app_orders(*)
                `)
                .eq('status', 'Canceled')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mapped = (data || []).map(item => ({
                id: item.id,
                dispatchNo: item.dispatch_number,
                cancelDate: item.updated_at || item.created_at,
                orderNo: item.order?.order_number || '-',
                clientName: item.order?.client_name || '-',
                itemName: item.order?.item_name || '-',
                godown: item.godown_name || '-',
                cancelQty: item.planned_qty || '0',
                remarks: item.remarks || 'Reason not specified'
            }));

            setCanceledItems(mapped);
        } catch (err) {
            console.error(err);
            showToast('Error', 'Failed to load cancelled orders: ' + err.message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => { fetchCanceledData(); }, [fetchCanceledData]);

    const sortedItems = useMemo(() => {
        let result = [...canceledItems].filter(it => 
            Object.values(it).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
        );
        if (sortConfig.key) {
            result.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];
                if (sortConfig.direction === 'asc') return aVal > bVal ? 1 : -1;
                return aVal < bVal ? 1 : -1;
            });
        }
        return result;
    }, [canceledItems, searchTerm, sortConfig]);

    const requestSort = (key) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    return (
        <div className="p-4 lg:p-6 max-w-[1500px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-red-50 p-2 rounded-lg text-red-500 shadow-sm"><XCircle size={28} /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Order Cancel Report</h1>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tracking all rejected quantities</p>
                    </div>
                    <button onClick={() => fetchCanceledData(true)} className="ml-4 flex items-center gap-2 px-4 py-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors border border-gray-200 text-sm font-bold shadow-sm">
                        <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
                <div className="relative max-w-sm w-full">
                    <input type="text" placeholder="Search cancellations..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500/20 outline-none text-sm transition-all" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] uppercase text-gray-500 font-black tracking-widest">
                                {[
                                    { label: 'Cancel Date', key: 'cancelDate' },
                                    { label: 'Original Order', key: 'orderNo' },
                                    { label: 'Cancel ID', key: 'dispatchNo' },
                                    { label: 'Customer', key: 'clientName' },
                                    { label: 'Product', key: 'itemName' },
                                    { label: 'Cancelled Qty', key: 'cancelQty', align: 'right' },
                                    { label: 'Godown', key: 'godown', align: 'center' },
                                    { label: 'Remarks', key: 'remarks' }
                                ].map((col) => (
                                    <th key={col.key} onClick={() => requestSort(col.key)} className={`px-6 py-5 cursor-pointer hover:bg-gray-100 transition-colors ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''}`}>
                                        <div className={`flex items-center gap-1.5 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                                            {col.label}
                                            <div className="flex flex-col opacity-30"><ChevronUp size={10} /><ChevronDown size={10} /></div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-[13px]">
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {[...Array(8)].map((_, j) => (
                                            <td key={j} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                        ))}
                                    </tr>
                                ))
                            ) : sortedItems.length === 0 ? (
                                <tr><td colSpan="8" className="p-20 text-center italic text-gray-400 font-bold">No cancelled items found.</td></tr>
                            ) : (
                                sortedItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-red-50/30 transition-colors h-16">
                                        <td className="px-6 py-3 font-bold text-gray-400">{formatDisplayDate(item.cancelDate)}</td>
                                        <td className="px-6 py-3 font-black text-gray-800">{item.orderNo}</td>
                                        <td className="px-6 py-3 font-medium text-red-400">{item.dispatchNo}</td>
                                        <td className="px-6 py-3 text-gray-600 font-bold">{item.clientName}</td>
                                        <td className="px-6 py-3 text-gray-500 font-medium">{item.itemName}</td>
                                        <td className="px-6 py-3 text-red-600 text-right font-black">{item.cancelQty}</td>
                                        <td className="px-6 py-3 text-gray-500 text-center underline decoration-dotted">{item.godown}</td>
                                        <td className="px-6 py-3 text-gray-400 italic text-xs">{item.remarks}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default OrderCancel;
