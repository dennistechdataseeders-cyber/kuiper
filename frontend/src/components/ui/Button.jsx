// variant: primary | secondary | ghost | danger | success | warning | plain
// size:    md (h-10) | sm (h-9 on desktop, 40px touch target on mobile)
// "plain" sets no colours: pass them in className.
const Button = ({ variant = 'primary', size = 'md', type = 'button', className = '', children, ...rest }) => (
  <button type={type} className={`btn btn-${size} btn-${variant} ${className}`} {...rest}>
    {children}
  </button>
);

export default Button;
