import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
  try {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved) {
      const parsed = JSON.parse(saved);
      return typeof parsed === 'boolean' ? parsed : false;
    }
    return false;
  } catch (e) {
    // If corrupted, reset it
    localStorage.removeItem('sidebarCollapsed');
    return false;
  }
});

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(prev => !prev);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};