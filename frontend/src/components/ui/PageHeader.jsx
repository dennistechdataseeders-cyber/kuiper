// Page title with its actions. The actions wrap below the title on mobile.
//   above    anything shown over the title (back link, badges)
//   actions  buttons on the right (desktop) / full-width row below the title (mobile)
const PageHeader = ({ title, subtitle, above, actions, actionsTitle }) => (
  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 sm:gap-4">
    <div className="min-w-0 flex-1">
      {above}
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {actions && (
      <div className="flex flex-wrap gap-2 w-full lg:w-auto lg:shrink-0" title={actionsTitle}>
        {actions}
      </div>
    )}
  </div>
);

export default PageHeader;
