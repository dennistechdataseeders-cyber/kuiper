// Scroll wrapper for wide tables: <ResponsiveTable><table>...</table></ResponsiveTable>
// On mobile the table keeps a readable width and scrolls sideways inside its card, and the
// first column stays in view. minWidth: the narrowest the table may get before it scrolls.
const ResponsiveTable = ({ minWidth = 640, stickyFirst = true, className = '', children }) => (
  <div
    className={`table-scroll overflow-x-auto ${stickyFirst ? 'table-sticky-first' : ''} ${className}`}
    style={{ '--table-min-w': `${minWidth}px` }}
  >
    {children}
  </div>
);

export default ResponsiveTable;
