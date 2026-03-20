import React, { useState, useEffect } from 'react';
import {
    RefreshCw,
    Loader2,
    Search,
    Table as TableIcon
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const API_URL = import.meta.env.VITE_SHEET_API_URL;

const DataTable = ({ title, sheetName, columns, renderActions, refreshCount, skipRows = 1, preFilterFn }) => {
    const { showToast } = useToast();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState(new Set());

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}?sheet=${encodeURIComponent(sheetName)}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch ${sheetName} data`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                // Skip rows based on prop (default is 1 to skip header)
                const rows = result.data.slice(skipRows);
                setData(rows);
                setSelectedRows(new Set()); // Clear selection on refresh
            } else {
                throw new Error(result.error || 'Unknown error fetching data');
            }

        } catch (error) {
            console.error(`Error fetching ${sheetName} data:`, error);
            showToast(`Error loading ${title}. Please try again.`, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [sheetName, refreshCount]);

    const filteredData = data
        .filter(row => !preFilterFn || preFilterFn(row))
        .filter(row =>
            row.some(cell => cell && cell.toString().toLowerCase().includes(searchTerm.toLowerCase()))
        );

    const toggleRow = (index) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedRows(newSelected);
    };

    const toggleAll = () => {
        if (selectedRows.size === filteredData.length && filteredData.length > 0) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(filteredData.map((_, index) => index)));
        }
    };

    return (
        <div className="h-[calc(100vh-3.5rem)] bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4 lg:p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between max-w-[1600px] mx-auto w-full">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <TableIcon className="text-green-500" />
                            {title}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search data..."
                                className="pl-9 pr-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-primary/20 focus:border-primary w-full sm:w-64"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        {renderActions && renderActions()}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-4 lg:p-6">
                <div className="bg-white rounded border border-gray-200 shadow-sm h-full flex flex-col max-w-[1600px] mx-auto">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-gray-600 font-medium">Fetching data...</p>
                        </div>
                    ) : filteredData.length > 0 ? (
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead className="sticky top-0 z-10 bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 border-b border-gray-200 w-10">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer"
                                                checked={filteredData.length > 0 && selectedRows.size === filteredData.length}
                                                onChange={toggleAll}
                                            />
                                        </th>
                                        {columns.map((col, idx) => (
                                            <th key={idx} className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                                                {col.header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredData.map((row, rowIndex) => (
                                        <tr
                                            key={rowIndex}
                                            className={`hover:bg-gray-50 transition-colors ${selectedRows.has(rowIndex) ? 'bg-green-50/50' : ''}`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap w-10">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer"
                                                    checked={selectedRows.has(rowIndex)}
                                                    onChange={() => toggleRow(rowIndex)}
                                                />
                                            </td>
                                            {columns.map((col, colIdx) => (
                                                <td key={colIdx} className={`px-6 py-4 text-sm ${col.bold ? 'text-gray-900 font-semibold' : 'text-gray-600'} whitespace-nowrap`}>
                                                    {row[col.index] || '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-500">
                            <TableIcon className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No records found</p>
                            <p className="text-sm max-w-xs mx-auto mt-2">
                                We couldn't find any data matching your search criteria.
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default DataTable;
