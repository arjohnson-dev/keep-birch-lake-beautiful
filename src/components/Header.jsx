import { useState } from "react";
import { HiBars3, HiXMark } from "react-icons/hi2";
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navId = "site-primary-navigation";

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <button
          type="button"
          className="site-header__menu-toggle"
          aria-expanded={isMenuOpen}
          aria-controls={navId}
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <HiXMark aria-hidden="true" /> : <HiBars3 aria-hidden="true" />}
        </button>

        <a
          className="site-header__brand"
          href="/"
          onClick={(event) => handleAppLinkClick(event, "/")}
        >
          Keep Birch Lake Beautiful
        </a>

        <nav
          id={navId}
          className={`site-header__nav${isMenuOpen ? " is-open" : ""}`}
          aria-label="Primary"
        >
          {navigationItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={isActivePath(pathname, item.href) ? "is-active" : ""}
              onClick={(event) => {
                setIsMenuOpen(false);
                handleAppLinkClick(event, item.href);
              }}
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
