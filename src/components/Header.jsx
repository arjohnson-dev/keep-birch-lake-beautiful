const navigationItems = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

function Header({ pathname }) {
  const handleNavigate = (event, href) => {
    const url = new URL(href, window.location.origin);
    if (
      window.location.pathname === url.pathname &&
      window.location.hash === url.hash
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    event.preventDefault();
    window.history.pushState({}, "", href);
    window.dispatchEvent(new Event("app:navigate"));
  };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a
          className="site-header__brand"
          href="/"
          onClick={(event) => handleNavigate(event, "/")}
        >
          Keep Birch Lake Beautiful
        </a>

        <nav className="site-header__nav" aria-label="Primary">
          {navigationItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "is-active" : ""}
              onClick={(event) => handleNavigate(event, item.href)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default Header;
