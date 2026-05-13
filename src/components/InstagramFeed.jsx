import { useEffect } from "react";

const CURATOR_SCRIPT_SRC =
  "https://cdn.curator.io/published/700445c7-929f-427d-9c57-e7be427a6113.js";
const FEED_CONTAINER_ID = "curator-feed-default-feed-layout";

function InstagramFeed() {
  useEffect(() => {
    const existingScript = document.querySelector(
      `script[src="${CURATOR_SCRIPT_SRC}"]`,
    );
    if (existingScript) {
      existingScript.remove();
    }

    const feedContainer = document.getElementById(FEED_CONTAINER_ID);
    if (feedContainer) {
      feedContainer.innerHTML =
        '<a href="https://curator.io" target="_blank" class="crt-logo crt-tag">Powered by Curator.io</a>';
    }

    const script = document.createElement("script");
    script.async = true;
    script.charset = "UTF-8";
    script.src = CURATOR_SCRIPT_SRC;
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <section className="instagram-section" aria-label="Instagram feed">
      <a
        className="instagram-section__button"
        href="https://www.instagram.com/keepbirchlakebeautiful"
        target="_blank"
        rel="noreferrer"
      >
        Visit us on Instagram
      </a>
      <p className="instagram-section__intro">
        Follow along on Instagram and tag us in photos using your new towels. A
        few lucky participants will be eligible to win an original piece by Coy
        Jankowski!
      </p>
      <div className="instagram-feed-shell">
        <div id={FEED_CONTAINER_ID}>
          <a
            href="https://curator.io"
            target="_blank"
            className="crt-logo crt-tag"
          >
            Powered by Curator.io
          </a>
        </div>
      </div>
    </section>
  );
}

export default InstagramFeed;
