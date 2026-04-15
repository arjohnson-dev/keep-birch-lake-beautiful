export function navigateTo(href) {
  const url = new URL(href, window.location.origin);

  if (
    window.location.pathname === url.pathname &&
    window.location.hash === url.hash &&
    window.location.search === url.search
  ) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event("app:navigate"));
}

export function handleAppLinkClick(event, href) {
  event.preventDefault();
  navigateTo(href);
}
