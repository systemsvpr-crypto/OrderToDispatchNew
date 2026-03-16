import React, { useState, useEffect } from 'react';
import { Plus, X, Save } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import SearchableDropdown from '../../components/SearchableDropdown';

const Order = () => {
    const { showToast } = useToast();
    const [orders, setOrders] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        orderDate: new Date().toISOString().split('T')[0],
        clientName: '',
        godownName: '',
        items: [{ itemName: '', rate: '', qty: '' }]
    });

    const [itemNames, setItemNames] = useState([]);
    const [clients, setClients] = useState([]);
    const [godowns, setGodowns] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [godownFilter, setGodownFilter] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

    const API_URL = import.meta.env.VITE_SHEET_orderToDispatch_URL;
    const MASTER_URL = import.meta.env.VITE_MASTER_URL;
    const SHEET_ID = import.meta.env.VITE_orderToDispatch_SHEET_ID;

    // Date formatter (e.g., 25-Feb-2026)
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

    useEffect(() => {
        fetchProducts();
        fetchClients();
        fetchGodowns();
        fetchOrders();
    }, []);

    // ----- Fetch orders from the ORDER sheet -----
    const fetchOrders = async () => {
        setIsLoadingOrders(true);
        try {
            if (!API_URL) {
                showToast('Error', 'API URL not configured');
                return;
            }

            const url = new URL(API_URL);
            url.searchParams.set('sheet', 'ORDER');
            url.searchParams.set('mode', 'table');
            if (SHEET_ID) url.searchParams.set('sheetId', SHEET_ID);

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Unknown error');

            let dataArray = result.data;
            if (!Array.isArray(dataArray)) dataArray = [];

            // If dataArray is empty, keep empty list
            if (dataArray.length === 0) {
                setOrders([]);
                return;
            }

            // Determine if response is array of objects or array of arrays
            const isArrayData = Array.isArray(dataArray[0]);

            // The image shows data starts at Row 7. 
            // If Apps Script returns data starting from Row 2 (slice(1)), 
            // then index 5 in the returned array corresponds to Row 7.
            const dataToMap = dataArray.slice(5);

            let mappedOrders;
            if (isArrayData) {
                // Fallback for array-of-arrays (adjust indices to your sheet)
                mappedOrders = dataToMap.map(item => ({
                    orderNumber: item[1] || '-',
                    orderDate:   item[2] || '-',
                    clientName:  item[3] || '-',
                    godownName:  item[4] || '-',
                    itemName:    item[5] || '-',
                    rate:        item[6] || '0',
                    qty:         item[7] || '0',
                    currentStock: item[8] || '-',
                    intransitQty: item[9] || '-'
                }));
            } else {
                // Use the clean object keys returned by the API
                mappedOrders = dataToMap.map(item => ({
                    orderNumber: item.orderNumber || '-',
                    orderDate:   item.orderDate   || '-',
                    clientName:  item.clientName  || '-',
                    godownName:  item.godownName  || '-',
                    itemName:    item.itemName    || '-',
                    rate:        item.rate        || '0',
                    qty:         item.qty         || '0',
                    currentStock: item.currentStock || '-',
                    intransitQty: item.intransitQty || '-'
                }));
            }

            setOrders(mappedOrders);
        } catch (error) {
            console.error('fetchOrders error:', error);
            showToast('Error', error.message);
        } finally {
            setIsLoadingOrders(false);
        }
    };

    // ----- Fetch master data (products, clients, godowns) -----
    const fetchProducts = async () => {
        if (!MASTER_URL) return;
        try {
            const res = await fetch(`${MASTER_URL}?sheet=Products`);
            const json = await res.json();
            if (json.success && json.data) setItemNames(json.data);
        } catch (error) {
            console.error('fetchProducts error:', error);
        }
    };

    const fetchClients = async () => {
        if (!MASTER_URL) return;
        try {
            const res = await fetch(`${MASTER_URL}?sheet=Sales Vendor`);
            const json = await res.json();
            if (json.success && json.data) setClients(json.data);
        } catch (error) {
            console.error('fetchClients error:', error);
        }
    };

    const fetchGodowns = async () => {
        if (!MASTER_URL) return;
        try {
            const res = await fetch(`${MASTER_URL}?sheet=Products&col=4`);
            const json = await res.json();
            if (json.success && json.data) setGodowns(json.data);
        } catch (error) {
            console.error('fetchGodowns error:', error);
        }
    };

    // ----- Filtering -----
    const filterClients = [...clients].sort((a, b) => String(a).localeCompare(b));
    const filterGodowns = [...godowns].sort((a, b) => String(a).localeCompare(b));

    const filteredOrders = orders.filter(order => {
        const matchesSearch = Object.values(order).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesClient = !clientFilter || order.clientName === clientFilter;
        const matchesGodown = !godownFilter || order.godownName === godownFilter;
        return matchesSearch && matchesClient && matchesGodown;
    });

    // ----- Form handlers -----
    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { itemName: '', rate: '', qty: '' }]
        }));
    };

    const handleRemoveItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index][field] = value;
            return { ...prev, items: newItems };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            if (!API_URL || !SHEET_ID) {
                showToast('Error', 'Missing API URL or Sheet ID');
                return;
            }

            const payload = {
                sheet: 'ORDER',
                sheetId: SHEET_ID,
                rows: formData.items.map(item => ({
                    orderDate: formData.orderDate,
                    clientName: formData.clientName,
                    godownName: formData.godownName,
                    itemName: item.itemName,
                    rate: item.rate,
                    qty: item.qty
                }))
            };

            // Use normal fetch (avoid 'no-cors' to see errors)
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Success overlay and reset
            setShowSuccessOverlay(true);
            setFormData({
                orderDate: new Date().toISOString().split('T')[0],
                clientName: '',
                godownName: '',
                items: [{ itemName: '', rate: '', qty: '' }]
            });
            setIsModalOpen(false);

            // Refresh orders after a short delay
            setTimeout(() => {
                fetchOrders();
                setShowSuccessOverlay(false);
            }, 2500);
        } catch (error) {
            console.error('Submit error:', error);
            showToast('Error', 'Submission failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ----- Render -----
    return (
        <div className="p-3 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-xl font-bold text-gray-800 mr-auto">Orders</h1>

                <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-40 lg:w-48 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-800 outline-none text-sm"
                />
                <SearchableDropdown
                    value={clientFilter}
                    onChange={setClientFilter}
                    options={filterClients}
                    allLabel="All Clients"
                    className="w-36 lg:w-44"
                />
                <SearchableDropdown
                    value={godownFilter}
                    onChange={setGodownFilter}
                    options={filterGodowns}
                    allLabel="All Godowns"
                    className="w-36 lg:w-44"
                />

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 shadow-md font-bold text-sm"
                >
                    <Plus size={18} />
                    Add Order
                </button>
            </div>

            {/* Loading overlay */}
            {isLoadingOrders && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-full border-4 border-gray-100 border-t-red-800 animate-spin" />
                        <p className="text-sm font-bold text-gray-800">Loading Orders...</p>
                    </div>
                </div>
            )}

            {/* Success overlay */}
            {showSuccessOverlay && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-fade-in-up">
                        <div className="h-20 w-20 bg-green-50 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-base font-black text-green-600">Order Saved Successfully</p>
                    </div>
                </div>
            )}

            {/* Data table / cards */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto max-h-[460px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3">Order Number</th>
                                <th className="px-4 py-3">Order Date</th>
                                <th className="px-4 py-3">Client</th>
                                <th className="px-4 py-3">Godown</th>
                                <th className="px-4 py-3">Item</th>
                                <th className="px-4 py-3">Rate</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3">Current Stock</th>
                                <th className="px-4 py-3">Intransit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-4 py-8 text-center text-gray-500 italic">
                                        No orders found.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-bold text-red-800">{order.orderNumber}</td>
                                        <td className="px-4 py-3 text-gray-600 text-xs">{formatDisplayDate(order.orderDate)}</td>
                                        <td className="px-4 py-3 font-semibold">{order.clientName}</td>
                                        <td className="px-4 py-3 text-gray-600">{order.godownName}</td>
                                        <td className="px-4 py-3 text-gray-600">{order.itemName}</td>
                                        <td className="px-4 py-3 font-medium">₹{order.rate}</td>
                                        <td className="px-4 py-3 text-right font-black text-red-800">{order.qty}</td>
                                        <td className="px-4 py-3 text-gray-600 text-xs">{order.currentStock}</td>
                                        <td className="px-4 py-3 text-gray-600 text-xs">{order.intransitQty}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-gray-200">
                    {filteredOrders.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 italic">No orders found.</div>
                    ) : (
                        filteredOrders.map((order, idx) => (
                            <div key={idx} className="p-4 space-y-2">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-gray-900">{order.clientName}</h4>
                                    <span className="px-2 py-0.5 bg-red-50 text-red-800 rounded text-[10px] font-bold">
                                        {order.orderNumber}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p className="text-gray-400 text-[9px] uppercase">Godown</p>
                                        <p className="font-medium">{order.godownName}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-[9px] uppercase">Date</p>
                                        <p className="font-medium">{formatDisplayDate(order.orderDate)}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-gray-400 text-[9px] uppercase">Item</p>
                                        <p className="font-bold">{order.itemName}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-[9px] uppercase">Rate</p>
                                        <p className="font-bold">₹{order.rate}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-[9px] uppercase">Qty</p>
                                        <p className="font-bold text-red-800">{order.qty}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add Order Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-[90vh] sm:max-w-4xl flex flex-col overflow-hidden">
                        {/* Fixed Header */}
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0 z-30">
                            <h2 className="text-xl font-bold text-gray-900">Add New Order</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 transition-colors hover:bg-gray-100 rounded-full">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 scrollbar-thin scrollbar-thumb-gray-200 bg-gray-50/30">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">Order Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.orderDate}
                                            onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-800 outline-none text-sm font-medium shadow-sm transition-all focus:border-red-800"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">Client Name</label>
                                        <SearchableDropdown
                                            value={formData.clientName}
                                            onChange={(val) => setFormData({ ...formData, clientName: val })}
                                            options={clients}
                                            placeholder="Select Client"
                                            showAll={false}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">Godown Name</label>
                                        <SearchableDropdown
                                            value={formData.godownName}
                                            onChange={(val) => setFormData({ ...formData, godownName: val })}
                                            options={godowns}
                                            placeholder="Select Godown"
                                            showAll={false}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex justify-between items-center pb-2 border-b-2 border-red-800/10">
                                        <h3 className="text-xs font-black text-red-800 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-800 animate-pulse" />
                                            Items Detail
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={handleAddItem}
                                            className="flex items-center gap-1.5 text-[10px] font-black text-red-800 hover:text-white hover:bg-red-800 transition-all px-4 py-1.5 rounded-full border-2 border-red-800 uppercase tracking-widest"
                                        >
                                            <Plus size={14} /> Add Item
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {formData.items.map((item, index) => (
                                            <div key={index} className="group relative flex flex-col gap-5 p-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-red-900/5 transition-all duration-300 focus-within:z-40">
                                                <div className="absolute top-0 left-0 w-1.5 h-full bg-red-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-end">
                                                    <div className="sm:col-span-6">
                                                        <label className="text-[9px] font-black text-gray-400 mb-1.5 uppercase tracking-widest block">Item Name</label>
                                                        <SearchableDropdown
                                                            value={item.itemName}
                                                            onChange={(val) => handleItemChange(index, 'itemName', val)}
                                                            options={itemNames}
                                                            placeholder="Select Item"
                                                            showAll={false}
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3">
                                                        <label className="text-[9px] font-black text-gray-400 mb-1.5 uppercase tracking-widest block">Rate</label>
                                                        <input
                                                            type="number"
                                                            required
                                                            placeholder="0.00"
                                                            value={item.rate}
                                                            onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-800 focus:bg-white outline-none text-sm font-medium transition-all"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3 flex gap-3 items-center">
                                                        <div className="flex-1">
                                                            <label className="text-[9px] font-black text-gray-400 mb-1.5 uppercase tracking-widest block">Qty</label>
                                                            <input
                                                                type="number"
                                                                required
                                                                placeholder="0"
                                                                value={item.qty}
                                                                onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-800 focus:bg-white outline-none text-sm font-bold text-red-800 transition-all"
                                                            />
                                                        </div>
                                                        {formData.items.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(index)}
                                                                className="mt-5 p-2.5 text-red-500 hover:text-white transition-all bg-red-50 hover:bg-red-500 rounded-2xl shadow-inner group-hover:rotate-90 transition-transform duration-300"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Fixed Footer */}
                            <div className="p-4 sm:p-6 border-t border-gray-100 bg-white flex flex-col-reverse sm:flex-row justify-end gap-4 shrink-0 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-10 py-3 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl hover:bg-gray-50 hover:text-gray-600 hover:border-gray-200 transition-all font-black text-[11px] uppercase tracking-[0.2em]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`flex items-center justify-center gap-3 px-10 py-3 bg-red-800 text-white rounded-2xl hover:bg-red-900 transition-all font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-red-800/30 active:scale-95 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    {isSubmitting ? 'Saving...' : 'Save Order'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Embedded Styles (safe inside component) */}
            <style>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(-360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 3s linear infinite;
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(15px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
};

export default Order;