const NAV = [
  { href: '/dev-utils/commercestore/index.html', label: 'Checkout' },
  { href: '/dev-utils/commercestore/express.html', label: 'Express' },
  { href: '/dev-utils/commercestore/payments.html', label: 'Payments' },
  { href: '/dev-utils/commercestore/admin.html', label: 'Admin' },
];

interface HeaderProps {
  active: string;
}

export default function Header({ active }: HeaderProps) {
  return (
    <div className="cs-header">
      <div className="cs-header-inner">
        <div className="cs-header-brand">
          <svg className="cs-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 298.34 333.32">
            <path fill="#6359ff" d="m49.72,224.6v-104.04c0-2.88,3.12-4.68,5.61-3.24l90.1,52.02c2.32,1.34,3.74,3.81,3.74,6.48v104.04c0,2.88-3.12,4.68-5.61,3.24l-90.1-52.02c-2.32-1.34-3.74-3.81-3.74-6.48Z"/>
            <path fill="#ffc806" d="m61.41,101.93l88.69-51.21c2.32-1.34,5.17-1.34,7.48,0l88.69,51.21c3.12,1.8,3.12,6.3,0,8.1l-88.69,51.21c-2.32,1.34-5.17,1.34-7.48,0l-88.69-51.21c-3.12-1.8-3.12-6.3,0-8.1Z"/>
            <path fill="#0bbfbf" d="m158.52,279.85v-96.48c0-2.88,3.12-4.68,5.61-3.24l82.15,47.43c3.12,1.8,3.12,6.3,0,8.1l-82.15,47.43c-2.49,1.44-5.61-.36-5.61-3.24Z"/>
          </svg>
          <span className="cs-header-title">commercestore</span>
        </div>
        <nav className="cs-nav">
          {NAV.map(({ href, label }) => (
            <a key={label} href={href} className={`cs-nav-link ${active === label ? 'active' : ''}`}>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
