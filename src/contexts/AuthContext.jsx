import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('otd_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const navigate = useNavigate();

  const login = async (id, pass) => {
    try {
      // Fetch user from Supabase using app_users table
      const { data: userRecord, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('user_id', id)
        .eq('password', pass)
        .single();

      if (userRecord && !error) {
        // Assume page_access is stored as JSONB array, fallback if not
        let pageAccess = [];
        if (Array.isArray(userRecord.page_access)) {
          pageAccess = userRecord.page_access;
        } else if (typeof userRecord.page_access === 'string') {
          pageAccess = JSON.parse(userRecord.page_access);
        }

        const userData = {
          id: userRecord.user_id,
          name: userRecord.user_name || userRecord.user_id,
          role: (userRecord.role || 'user').toLowerCase(),
          pageAccess: pageAccess
        };

        setUser(userData);
        localStorage.setItem('otd_user', JSON.stringify(userData));
        return true;
      }
    } catch (error) {
      console.error('Supabase Login error:', error);
    }

    // Fallback for hardcoded admin during development if fetch fails
    if (id === "admin" && pass === "admin123") {
      const allPages = ["Dashboard", "Order", "Dispatch Planning", "Inform to Party Before Dispatch", "Dispatch Completed", "Inform to Party After Dispatch", "Godown", "PC Report", "Skip Delivered", "Settings"];
      const userData = { id: "admin", name: "Administrator", role: "admin", pageAccess: allPages };
      setUser(userData);
      localStorage.setItem('otd_user', JSON.stringify(userData));
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('otd_user');
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
