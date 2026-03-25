import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import vprLogo from "../assets/vpr-logo.jpeg";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Truck,
  BellRing,
  CheckCircle,
  Mail,
  PackageX,
  Warehouse,
  FileText,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Footer from "../components/Footer";

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // States
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sync mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const isActive = (path) => location.pathname === path;

  const navigationItems = [
    { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Order", path: "/admin/order", icon: ClipboardList },
    { label: "Dispatch Planning", path: "/admin/dispatch-planning", icon: Truck },
    { label: "Inform to Party Before Dispatch", path: "/admin/notify-party", icon: BellRing },
    { label: "Dispatch Completed", path: "/admin/dispatch-done", icon: CheckCircle },
    { label: "Inform to Party After Dispatch", path: "/admin/post-dispatch-notify", icon: Mail },
    { label: "Skip Delivered", path: "/admin/skip-delivered", icon: PackageX },
    { label: "Godown", path: "/admin/godown", icon: Warehouse },
    { label: "PC Report", path: "/admin/pc-report", icon: FileText },
    { label: "Settings", path: "/admin/settings", icon: SettingsIcon },
  ];

  const filteredNavItems = navigationItems.filter(item =>
    user?.pageAccess?.some(p => p.toLowerCase().trim() === item.label.toLowerCase().trim())
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5] font-sans">
      {/* Navbar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 fixed top-0 left-0 right-0 z-[40] h-16 shadow-sm flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl hover:bg-green-50 text-gray-600 transition-all duration-300 active:scale-90 lg:hidden"
            style={{ color: '#58cc02' }}
          >
            {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/admin/dashboard" className="flex items-center gap-3 group">
            <img
              src={vprLogo}
              alt="Vijay Industries Logo"
              className="h-12 w-auto object-contain transition-all duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-3xl font-black tracking-tight text-gray-800 hidden sm:block leading-none ">
                ORDER<span className="text-primary">TO</span>DELIVERY
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-black text-gray-800 leading-none">{user?.name}</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest mt-0.5">{user?.role}</span>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 text-gray-600 font-bold text-sm hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 group"
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="hidden md:block">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 pt-16 relative overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`
            bg-white border-r border-gray-100 fixed top-16 bottom-0 left-0 z-30 transition-all duration-500 ease-[cubic-bezier(0.4, 0, 0.2, 1)]
            ${isMobileOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full lg:translate-x-0"}
            ${isCollapsed ? "lg:w-20" : "lg:w-64"}
          `}
        >
          {/* Collapse Toggle (Desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-100 rounded-full items-center justify-center text-primary shadow-sm hover:shadow-md transition-all hidden lg:flex z-50"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <div className="h-full flex flex-col pt-6">
            <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto no-scrollbar pb-20">
              {filteredNavItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 relative group
                      ${active
                        ? "bg-primary text-white shadow-lg shadow-primary/25"
                        : "text-gray-500 hover:bg-green-50 hover:text-primary"}
                    `}
                  >
                    <div className={`shrink-0 transition-all duration-300 ${active ? 'scale-110' : 'group-hover:scale-110 group-active:scale-95'}`}>
                      <item.icon size={20} />
                    </div>
                    <span className={`
                      text-sm font-bold truncate transition-all duration-300 whitespace-nowrap
                      ${isCollapsed ? "lg:opacity-0 lg:w-0" : "opacity-100 w-full"}
                    `}>
                      {item.label}
                    </span>

                    {/* Collapsed Tooltip (Simple Mockup) */}
                    {isCollapsed && (
                      <div className="absolute left-16 hidden lg:group-hover:block bg-gray-900 text-white text-[10px] font-black uppercase px-3 py-2 rounded-lg whitespace-nowrap z-[100] shadow-xl pointer-events-none">
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}

              {filteredNavItems.length === 0 && (
                <div className="p-4 text-center">
                  <PackageX size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">No Module Access</p>
                </div>
              )}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main
          className={`
            flex-1 w-full bg-[#F5F5F5] min-h-[calc(100vh-4rem)] transition-all duration-500 ease-[cubic-bezier(0.4, 0, 0.2, 1)]
            ${isCollapsed ? "lg:ml-20" : "lg:ml-64"}
            pb-24 sm:pb-32
          `}
        >
          <div className="p-0 sm:p-4 max-w-[1200px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Footer (Fixed at bottom if not scrolling) */}
      <Footer />

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-20 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminLayout;
