// White card: rounded-xl border p-4 sm:p-5 (see .card in index.css)
const Card = ({ title, icon, actions, className = '', children }) => (
  <section className={`card ${className}`}>
    {(title || actions) && (
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        {title && (
          <h2 className="section-title flex items-center gap-2 min-w-0">
            {icon}
            <span className="min-w-0 break-words">{title}</span>
          </h2>
        )}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

export default Card;
