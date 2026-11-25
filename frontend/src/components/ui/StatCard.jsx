// Number tile for the dashboards: label and value on the left, icon on the right
const StatCard = ({ label, value, icon, valueClass = 'text-gray-900', className = '' }) => (
  <div className={`card flex items-center justify-between gap-2 min-w-0 ${className}`}>
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
    {icon && <div className="shrink-0">{icon}</div>}
  </div>
);

export default StatCard;
