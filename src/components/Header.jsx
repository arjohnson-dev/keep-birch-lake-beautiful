import HeaderCartButton from "./shop/HeaderCartButton.jsx";
import { useCart } from "../context/CartContext.jsx";
import { handleAppLinkClick } from "../lib/navigation.js";

const navigationItems = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

function isActivePath(currentPath, href) {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function Header({ pathname }) {
  const { count, openCart } = useCart();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a
          className="site-header__brand"
          href="/"
          onClick={(event) => handleAppLinkClick(event, "/")}
        >
          Keep Birch Lake Beautiful
        </a>

        <nav className="site-header__nav" aria-label="Primary">
          {navigationItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={isActivePath(pathname, item.href) ? "is-active" : ""}
              onClick={(event) => handleAppLinkClick(event, item.href)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <HeaderCartButton count={count} onOpen={openCart} />
      </div>
    </header>
  );
}

export default Header;
