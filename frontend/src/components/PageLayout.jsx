// frontend/src/components/PageLayout.jsx
// The only place that knows about the sidebar offset. Pages must not add their own
// ml-64 / ml-20: they render inside <main>, which is padded with the CSS variables set by
// .app-shell (index.css):
//   --sidebar-w  0 on mobile, the collapsed / expanded sidebar width on desktop
//   --topbar-h   height of the mobile top bar, 0 on desktop
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useSidebar } from '../context/SidebarContext';

const PageLayout = ({ children }) => {
  const { isCollapsed, isMobileOpen, openMobile } = useSidebar();

  return (
    <div className="app-shell flex bg-[#f8fafc] min-h-screen" data-collapsed={isCollapsed}>
      <Sidebar />

      {/* Mobile top bar: holds the menu button, so nothing floats over the page */}
      <header className="app-topbar md:hidden">
        <button
          type="button"
          onClick={openMobile}
          aria-label="Open menu"
          aria-expanded={isMobileOpen}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-white hover:bg-slate-800 transition-colors"
        >
          <Menu size={22} />
        </button>
        <img src="/images/login_img.webp" alt="" className="w-8 h-8 object-contain" />
        <span className="text-base font-bold tracking-[0.25em] text-white">KUIPER</span>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
};

export default PageLayout;
