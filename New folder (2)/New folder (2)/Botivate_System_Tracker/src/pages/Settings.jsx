import React, { useState, useEffect, useCallback } from 'react';
import { useSystem } from '../context/SystemContext';
import { Trash2, AlertTriangle, UserPlus, X, Loader2, Edit2, ShieldCheck, User as UserIcon, CheckCircle2, XCircle } from 'lucide-react';
import { STORAGE_KEYS, LocalStorageHelper, seedUsers } from '../utils/LocalStorageHelper';
import { fetchSheetData, insertRow, batchUpdateCells, updateCell } from '../utils/appScriptService';

const Settings = () => {
    const { resetSystem, systems } = useSystem();
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [editingUserIndex, setEditingUserIndex] = useState(null);
    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '',
        username: '',
        password: '',
        role: 'user',
        pageAccess: ''
    });

    // Custom delete popup state
    // phase: 'confirm' | 'result'
    // type (result): 'success' | 'error'
    const [deleteDialog, setDeleteDialog] = useState(null);
    // { phase: 'confirm', index, username }
    // { phase: 'result', type: 'success'|'error', message: string }

    useEffect(() => {
        const loadUsers = async () => {
            setIsLoadingUsers(true);
            try {
                const result = await fetchSheetData('Login Master');
                if (result.success && result.data) {
                    const allUsers = result.data.slice(1).map((row, index) => ({
                        id: `U-${index}`,
                        sheetRowIndex: index + 2,
                        name: row[0] || '',
                        username: row[1] || '',
                        password: row[2] || '',
                        role: row[3] || 'user',
                        pageAccess: row[4] || '',
                        deleted: row[5] || ''
                    }));
                    const activeUsers = allUsers.filter(u => u.deleted.toLowerCase() !== 'deleted');
                    setUsers(activeUsers);
                    LocalStorageHelper.set(STORAGE_KEYS.USERS, activeUsers);
                } else {
                    const existing = LocalStorageHelper.get(STORAGE_KEYS.USERS);
                    if (existing) setUsers(existing);
                }
            } catch (error) {
                console.error('Error fetching users:', error);
                const existing = LocalStorageHelper.get(STORAGE_KEYS.USERS);
                if (existing) setUsers(existing);
            } finally {
                setIsLoadingUsers(false);
            }
        };
        loadUsers();
    }, []);

    const handleClearData = () => {
        if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
            resetSystem();
            alert('System data cleared successfully.');
            window.location.reload();
        }
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(systems, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "system_tracker_export.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleResetUsers = () => {
        if (confirm('Reset default users? You will be logged out.')) {
            LocalStorageHelper.remove(STORAGE_KEYS.USERS);
            LocalStorageHelper.remove(STORAGE_KEYS.CURRENT_USER);
            seedUsers();
            alert('Users reset to default. You may be logged out.');
            window.location.href = '/login';
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setIsSavingUser(true);

        const rowData = [
            newUser.name,
            newUser.username,
            newUser.password,
            newUser.role,
            newUser.pageAccess
        ];

        try {
            if (isEditingUser && editingUserIndex !== null) {
                const rowIndex = users[editingUserIndex].sheetRowIndex;

                const result = await batchUpdateCells('Login Master', rowIndex, {
                    1: newUser.name,
                    2: newUser.username,
                    3: newUser.password,
                    4: newUser.role,
                    5: newUser.pageAccess
                });

                if (result.success) {
                    const updatedUsers = [...users];
                    updatedUsers[editingUserIndex] = { ...users[editingUserIndex], ...newUser };
                    setUsers(updatedUsers);
                    LocalStorageHelper.set(STORAGE_KEYS.USERS, updatedUsers);
                    alert('User updated successfully in Google Sheet!');
                    resetModalState();
                } else {
                    alert('Failed to update user: ' + result.error);
                }
            } else {
                const result = await insertRow('Login Master', rowData);

                if (result.success) {
                    const userToAdd = {
                        id: `U-${Date.now()}`,
                        ...newUser
                    };
                    const updatedUsers = [...users, userToAdd];
                    setUsers(updatedUsers);
                    LocalStorageHelper.set(STORAGE_KEYS.USERS, updatedUsers);
                    alert('User added successfully to Google Sheet!');
                    resetModalState();
                } else {
                    alert('Failed to save user: ' + result.error);
                }
            }
        } catch (error) {
            console.error('Error saving user:', error);
            alert('An error occurred while saving user.');
        } finally {
            setIsSavingUser(false);
        }
    };

    const handleEditUserClick = (index, user) => {
        setNewUser({
            name: user.name || '',
            username: user.username || '',
            password: user.password || '',
            role: user.role || 'user',
            pageAccess: user.pageAccess || ''
        });
        setIsEditingUser(true);
        setEditingUserIndex(index);
        setShowAddUserModal(true);
    };

    const handleDeleteUserClick = (index, username) => {
        // Show custom confirm popup
        setDeleteDialog({ phase: 'confirm', index, username });
    };

    const confirmDelete = async () => {
        const { index } = deleteDialog;
        setDeleteDialog(null);
        setIsLoadingUsers(true);
        try {
            const rowIndex = users[index]?.sheetRowIndex;
            if (!rowIndex) {
                setDeleteDialog({ phase: 'result', type: 'error', message: 'Row index is missing. Please refresh the page and try again.' });
                setIsLoadingUsers(false);
                return;
            }
            const result = await updateCell('Login Master', rowIndex, 6, 'deleted');

            if (result.success) {
                const updatedUsers = users.filter((_, i) => i !== index);
                setUsers(updatedUsers);
                LocalStorageHelper.set(STORAGE_KEYS.USERS, updatedUsers);
                setDeleteDialog({ phase: 'result', type: 'success', message: 'User deleted successfully!' });
            } else {
                setDeleteDialog({ phase: 'result', type: 'error', message: 'Failed to delete user: ' + result.error });
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            setDeleteDialog({ phase: 'result', type: 'error', message: 'An error occurred while deleting user.' });
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const resetModalState = () => {
        setShowAddUserModal(false);
        setIsEditingUser(false);
        setEditingUserIndex(null);
        setNewUser({ name: '', username: '', password: '', role: 'user', pageAccess: '' });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'role') {
            if (value === 'admin') {
                setNewUser(prev => ({ ...prev, role: value, pageAccess: availablePages.join(', ') }));
            } else {
                setNewUser(prev => ({ ...prev, role: value, pageAccess: '' }));
            }
        } else {
            setNewUser(prev => ({ ...prev, [name]: value }));
        }
    };

    const handlePageAccessChange = (page) => {
        if (newUser.role === 'admin') return;
        let currentAccess = newUser.pageAccess ? newUser.pageAccess.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (currentAccess.includes(page)) {
            currentAccess = currentAccess.filter(p => p !== page);
        } else {
            currentAccess.push(page);
        }
        setNewUser(prev => ({ ...prev, pageAccess: currentAccess.join(', ') }));
    };

    const availablePages = [
        'Dashboard',
        'Requirement Update',
        'Req. Understanding',
        'Sample Design',
        'Design Update',
        'Final Approval',
        'Testing',
        'Code Review',
        'User Training',
        'Go Live',
        'System Indexing',
        'MIS Integration',
        'Settings'
    ];

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h2 className="text-xl font-bold text-slate-800">Settings</h2>
                <p className="text-sm text-slate-500">Manage users and system configuration</p>
            </div>

            {/* Header bar with Add User button */}
            <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <span className="text-sm font-medium text-slate-600">
                    Login Master — Users ({isLoadingUsers ? '…' : users.length})
                </span>
                <button
                    onClick={() => setShowAddUserModal(true)}
                    className="px-3 py-1.5 bg-sky-500 text-white text-xs font-medium rounded hover:bg-sky-600 shadow-sm transition-colors flex items-center gap-1"
                >
                    <UserPlus size={13} /> Add User
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Username</th>
                            <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Password</th>
                            <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Role</th>
                            <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Page Access</th>
                            <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoadingUsers && (
                            <tr>
                                <td colSpan="6" className="px-4 py-10 text-center text-slate-400">
                                    <Loader2 className="animate-spin inline mr-2" size={16} />
                                    Loading users…
                                </td>
                            </tr>
                        )}
                        {!isLoadingUsers && users.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-4 py-10 text-center text-slate-400">
                                    No users found.
                                </td>
                            </tr>
                        )}
                        {!isLoadingUsers && users.map((user, idx) => (
                            <tr key={user.id || idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-semibold text-slate-800">{user.name}</td>
                                <td className="px-4 py-3 text-slate-600">{user.username}</td>
                                <td className="px-4 py-3 text-slate-500 font-mono text-xs tracking-widest">
                                    {'•'.repeat(Math.min(user.password?.length || 0, 8))}
                                </td>
                                <td className="px-4 py-3">
                                    {user.role === 'admin' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                            <ShieldCheck size={11} /> Admin
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                            <UserIcon size={11} /> User
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs max-w-[220px] truncate" title={user.pageAccess}>
                                    {user.pageAccess || <span className="text-slate-300 italic">—</span>}
                                </td>
                                <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                    <button
                                        onClick={() => handleEditUserClick(idx, user)}
                                        className="p-1.5 text-sky-600 hover:bg-sky-50 rounded transition-colors inline-block"
                                        title="Edit User"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUserClick(idx, user.username)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors inline-block"
                                        title="Delete User"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add / Edit User Modal */}
            {showAddUserModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-base font-bold text-slate-800">
                                    {isEditingUser ? 'Edit User' : 'Add New User'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {isEditingUser ? 'Update the user details below.' : 'Fill in the details to create a new user.'}
                                </p>
                            </div>
                            <button
                                onClick={resetModalState}
                                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddUser} className="p-6 space-y-4">
                            {/* Basic Info */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-100 space-y-3">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2">
                                    User Details
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            value={newUser.name}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 text-sm border border-sky-200 rounded focus:outline-none focus:border-sky-500 bg-white"
                                            placeholder="e.g. John Doe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
                                        <input
                                            type="text"
                                            name="username"
                                            required
                                            value={newUser.username}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 text-sm border border-sky-200 rounded focus:outline-none focus:border-sky-500 bg-white"
                                            placeholder="e.g. johndoe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                                        <input
                                            type="text"
                                            name="password"
                                            required
                                            value={newUser.password}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 text-sm border border-sky-200 rounded focus:outline-none focus:border-sky-500 bg-white"
                                            placeholder="Enter password"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                                        <select
                                            name="role"
                                            value={newUser.role}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 text-sm border border-sky-200 rounded focus:outline-none focus:border-sky-500 bg-white"
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Page Access */}
                            <div className={`p-4 rounded border space-y-2 ${newUser.role === 'admin' ? 'border-purple-200 bg-purple-50/50' : 'border-slate-100 bg-slate-50'}`}>
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Page Access
                                    </h4>
                                    {newUser.role === 'admin' && (
                                        <span className="text-xs font-medium text-purple-600 flex items-center gap-1">
                                            <ShieldCheck size={12} /> Full Access
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                                    {availablePages.map(page => {
                                        const isAdmin = newUser.role === 'admin';
                                        const isChecked = isAdmin
                                            ? true
                                            : (newUser.pageAccess
                                                ? newUser.pageAccess.split(',').map(s => s.trim()).filter(Boolean).includes(page)
                                                : false);
                                        return (
                                            <label
                                                key={page}
                                                className={`flex items-center gap-2 text-xs text-slate-700 p-1.5 rounded transition-colors ${isAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    disabled={isAdmin}
                                                    onChange={() => handlePageAccessChange(page)}
                                                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                                                />
                                                <span className="select-none">{page}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-slate-400 pt-1">
                                    {newUser.role === 'admin'
                                        ? 'Admin users automatically have access to all pages.'
                                        : 'Select the pages this user can access.'}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={resetModalState}
                                    disabled={isSavingUser}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingUser}
                                    className="px-5 py-2 bg-sky-500 text-white text-sm rounded hover:bg-sky-600 shadow-md shadow-sky-500/20 transition-all font-medium disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {isSavingUser && <Loader2 className="animate-spin" size={14} />}
                                    {isSavingUser ? 'Saving…' : (isEditingUser ? 'Update User' : 'Save User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Popup ── */}
            {deleteDialog?.phase === 'confirm' && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                        <div className="px-6 py-5 flex flex-col items-center text-center gap-3">
                            <div className="w-12 h-12 rounded bg-red-50 flex items-center justify-center">
                                <Trash2 size={22} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Delete User?</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Are you sure you want to delete&nbsp;
                                    <span className="font-semibold text-slate-700">{deleteDialog.username}</span>?
                                    <br />This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex border-t border-slate-100">
                            <button
                                onClick={() => setDeleteDialog(null)}
                                className="flex-1 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-3 text-sm text-white bg-red-500 hover:bg-red-600 transition-colors font-medium"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Result Popup (Success / Error) ── */}
            {deleteDialog?.phase === 'result' && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                        <div className="px-6 py-5 flex flex-col items-center text-center gap-3">
                            {deleteDialog.type === 'success' ? (
                                <div className="w-12 h-12 rounded bg-emerald-50 flex items-center justify-center">
                                    <CheckCircle2 size={24} className="text-emerald-500" />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded bg-red-50 flex items-center justify-center">
                                    <XCircle size={24} className="text-red-500" />
                                </div>
                            )}
                            <div>
                                <h3 className={`text-base font-bold ${deleteDialog.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {deleteDialog.type === 'success' ? 'Deleted!' : 'Error'}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">{deleteDialog.message}</p>
                            </div>
                        </div>
                        <div className="border-t border-slate-100">
                            <button
                                onClick={() => setDeleteDialog(null)}
                                className="w-full px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
