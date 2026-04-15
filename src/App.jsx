import { useEffect, useState } from "react";
import Footer from "./components/Footer.jsx";
import Header from "./components/Header.jsx";
import AboutView from "./views/AboutView.jsx";
import ContactView from "./views/ContactView.jsx";
import HomeView from "./views/HomeView.jsx";
import ShopView from "./views/ShopView.jsx";

const routes = {
  "/": HomeView,
  "/about": AboutView,
  "/shop": ShopView,
  "/contact": ContactView,
};

function App() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname);
      window.scrollTo({ top: 0, behavior: "instant" });

      // Handle hash scrolling after a short delay to ensure DOM is updated
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

  const ActiveView = routes[pathname] ?? HomeView;

  return (
    <div id="top" className="page-shell">
      <Header pathname={pathname} />

      <main className="app-shell">
        <ActiveView />
      </main>

      <Footer />
    </div>
  );
}

export default App;
