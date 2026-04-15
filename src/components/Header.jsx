const navigationItems = [
  { href: '#home', label: 'Home' },
  { href: '#about', label: 'About Us' },
  { href: '#shop', label: 'Shop' },
  { href: '#contact', label: 'Contact' },
]

function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="#home">
          Keep Birch Lake Beautiful
        </a>

        <nav className="site-header__nav" aria-label="Primary">
          {navigationItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default Header
