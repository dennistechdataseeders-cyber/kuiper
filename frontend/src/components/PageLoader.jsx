// frontend/src/components/PageLoader.jsx
// Shown while a lazily loaded page chunk downloads (usually a fraction of a second).
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading page">
    <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-blue-600 animate-spin" />
  </div>
);

export default PageLoader;
