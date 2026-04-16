import { useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Footer from "./components/Footer.jsx";
import Header from "./components/Header.jsx";
import CartDrawer from "./components/shop/CartDrawer.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import AboutView from "./views/AboutView.jsx";
import ContactView from "./views/ContactView.jsx";
import ShopCartView from "./views/ShopCartView.jsx";
import HomeView from "./views/HomeView.jsx";
import ShopProductView from "./views/ShopProductView.jsx";
import ShopView from "./views/ShopView.jsx";
import ThankYouView from "./views/ThankYouView.jsx";

const routes = {
  "/": HomeView,
  "/about": AboutView,
  "/shop": ShopView,
  "/shop/cart": ShopCartView,
  "/contact": ContactView,
  "/thank-you": ThankYouView,
  "/shop/cancel": ShopView,
};

function resolveShopProductPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[0] !== "shop") {
    return null;
  }

  return {
    category: parts[1],
    garment: parts[2],
    design: parts[3],
  };
}

function AppFrame() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname);
      window.scrollTo({ top: 0, behavior: "instant" });

      if (window.location.hash) {
        setTimeout(() => {
          const element = document.querySelector(window.location.hash);
          if (element) {
            element.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("app:navigate", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("app:navigate", handleLocationChange);
    };
  }, []);

  const productRoute = resolveShopProductPath(pathname);
  const ActiveView = productRoute ? ShopProductView : routes[pathname] ?? HomeView;
  const viewProps = productRoute ?? {};

  return (
    <div id="top" className="page-shell">
      <Header pathname={pathname} />

      <main className="app-shell">
        <ActiveView {...viewProps} />
      </main>

      <Footer />
      <CartDrawer />
    </div>
  );
}

function App() {
  return (
    <CartProvider>
      <AppFrame />
      <SpeedInsights />
    </CartProvider>
  );
}

export default App;
