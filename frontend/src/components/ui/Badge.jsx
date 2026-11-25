// Pass the colours in className, e.g. <Badge className="bg-blue-100 text-blue-700">Open</Badge>
const Badge = ({ className = '', children, ...rest }) => (
  <span className={`badge ${className}`} {...rest}>
    {children}
  </span>
);

export default Badge;
