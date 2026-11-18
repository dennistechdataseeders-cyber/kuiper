// frontend/src/pageLoaders.js
// One import() per page. App.jsx turns these into React.lazy routes; Login uses them to
// prefetch the user's dashboard right after sign-in.
export const pageLoaders = {
  ViewAnalytics: () => import('./pages/ViewAnalytics'),
  UserManagement: () => import('./pages/UserManagement'),
  ProjectManagement: () => import('./pages/ProjectManagement'),
  AdminDashboard: () => import('./pages/AdminDashboard'),
  SalesDashboard: () => import('./pages/SalesDashboard'),
  SalesManagerDashboard: () => import('./pages/SalesManagerDashboard'),
  LeadGeneration: () => import('./pages/LeadGeneration'),
  DeveloperDashboard: () => import('./pages/DeveloperDashboard'),
  Profile: () => import('./pages/Profile'),
  ProjectFeeds: () => import('./pages/ProjectFeeds'),
  Worklog: () => import('./pages/Worklog'),
  ResourceAnalytics: () => import('./pages/ResourceAnalytics'),
  TicketDashboard: () => import('./pages/TicketDashboard'),
  CreateTicket: () => import('./pages/CreateTicket'),
  TicketDetails: () => import('./pages/TicketDetails'),
  NotificationSettings: () => import('./pages/NotificationSettings'),
  GitManager: () => import('./pages/GitManager'),
  DeveloperGitFeeds: () => import('./pages/DeveloperGitFeeds'),
  AdminProjectClients: () => import('./pages/AdminProjectClients'),
  DeveloperProjects: () => import('./pages/DeveloperProjects'),
  DeveloperFeeds: () => import('./pages/DeveloperFeeds'),
  TeamLeadDashboard: () => import('./pages/TeamLeadDashboard'),
  TeamLeadProjects: () => import('./pages/TeamLeadProjects'),
  TeamLeadDevelopers: () => import('./pages/TeamLeadDevelopers'),
  TeamLeadFeeds: () => import('./pages/TeamLeadFeeds'),
  TicketAssignmentRules: () => import('./pages/TicketAssignmentRules'),
  TicketCategoriesManager: () => import('./pages/TicketCategoriesManager'),
  FeedDeliveryDashboard: () => import('./pages/FeedDeliveryDashboard'),
  ProjectFeedStatus: () => import('./pages/ProjectFeedStatus'),
  AttendanceSync: () => import('./pages/AttendanceSync'),
  KnowledgeBase: () => import('./pages/KnowledgeBase'),
  FeasibilityDashboard: () => import('./pages/FeasibilityDashboard'),
  PmFeasibilityDashboard: () => import('./pages/PmFeasibilityDashboard'),
  PmDashboard: () => import('./pages/PmDashboard'),
  EmployeeAttendanceDetail: () => import('./pages/EmployeeAttendanceDetail'),
  EmployeeAttendanceReport: () => import('./pages/EmployeeAttendanceReport'),
  Announcements: () => import('./pages/Announcements'),
  HolidayList: () => import('./pages/HolidayList'),
  WorkReport: () => import('./pages/WorkReport'),
  Leads: () => import('./pages/Leads'),
  Accounts: () => import('./pages/Accounts'),
  Contacts: () => import('./pages/Contacts'),
  CreateAccount: () => import('./pages/CreateAccount'),
  Deals: () => import('./pages/Deals'),
  AccountDetail: () => import('./pages/AccountDetail'),
  ContactDetail: () => import('./pages/ContactDetail'),
  DealDetail: () => import('./pages/DealDetail'),
  CustomizeModules: () => import('./pages/CustomizeModules'),
  ActivitiesTasks: () => import('./pages/ActivitiesTasks'),
  ActivitiesMeetings: () => import('./pages/ActivitiesMeetings'),
  ActivitiesCalls: () => import('./pages/ActivitiesCalls'),
  ActivityDetail: () => import('./pages/ActivityDetail'),
  HrDashboard: () => import('./pages/HrDashboard'),
  EmployeeDashboard: () => import('./pages/EmployeeDashboard'),
  HrLeaveDashboard: () => import('./pages/HrLeaveDashboard'),
};

// Landing page per role (same mapping as App.jsx landingPath) -> page to prefetch
const LANDING_PAGE = {
  'Super Admin': 'AdminDashboard', Admin: 'AdminDashboard',
  'Sales Manager': 'SalesManagerDashboard', Sales: 'SalesDashboard',
  'Project Manager': 'ProjectManagement', 'Project Coordinator': 'ProjectManagement',
  Developer: 'DeveloperDashboard', Client: 'FeedDeliveryDashboard', 'Team Lead': 'TeamLeadDashboard',
  HR: 'HrDashboard', Finance: 'TicketDashboard',
};

// Start downloading the role's first page (errors are ignored: the route will retry).
export const prefetchLanding = (role) => {
  const page = LANDING_PAGE[role];
  if (page && pageLoaders[page]) pageLoaders[page]().catch(() => {});
};
