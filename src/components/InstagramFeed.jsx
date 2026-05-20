import { useEffect } from "react";

const CURATOR_ASSETS = [
  "https://cdn.curator.io/6.0/curator.embed.css",
  "https://cdn.curator.io/published-css/700445c7-929f-427d-9c57-e7be427a6113.css",
  "https://cdn.curator.io/6.0/curator.embed.js",
];
const FEED_CONTAINER_ID = "curator-feed-default-feed-layout";
const CURATOR_CONTAINER_SELECTOR = `#${FEED_CONTAINER_ID}`;
const CURATOR_BRAND_LINK =
  '<a href="https://curator.io" target="_blank" class="crt-logo crt-tag">Powered by Curator.io</a>';
const CURATOR_CONFIG = {
  post: {
    template: "post-mosaic",
    minWidth: 150,
    clickReadMoreAction: "open-popup",
    useHighQualityImages: false,
  },
  widget: {
    showLoadMore: true,
    switchPosts: true,
    rows: 6,
    autoLoadNew: false,
    lazyLoadType: "none",
    gridMobile: true,
    gridMobileRows: 3,
    gridMobileShowLoadMore: true,
    gridMobileDimensions: "1:1",
  },
  lang: "en",
  container: CURATOR_CONTAINER_SELECTOR,
  debug: 0,
  embedSource: "",
  forceHttps: false,
  feed: {
    id: "700445c7-929f-427d-9c57-e7be427a6113",
    apiEndpoint: "https://api.curator.io",
    postsPerPage: 12,
    params: [],
    limit: 25,
  },
  popup: {
    template: "popup",
    templateWrapper: "popup-wrapper",
    autoPlayVideos: false,
  },
  filter: {
    template: "filter",
    showNetworks: false,
    showSources: false,
    limitPostNumber: 0,
    period: "",
  },
  type: "Mosaic",
  theme: "sydney",
};
const CURATOR_COLOURS = {
  widgetBgColor: "transparent",
  bgColor: "#ffffff",
  borderColor: "transparent",
  iconColor: "#222222",
  textColor: "#222222",
  linkColor: "#595959",
  dateColor: "#000000",
  footerColor: "#ffffff",
  tabIndexColor: "#cccccc",
  buttonColor: "#dddddd",
  popupBgColor: "#ffffff",
  popupLetterboxColor: "#F5F5F5",
  popupTextColor: "#222222",
  popupLinkColor: "#595959",
  popupIconColor: "#222222",
  popupDateColor: "#222222",
  shareBgColor: "#ffffff",
  shareTextColor: "#222222",
  shareIconColor: "#222222",
};

let curatorAssetsPromise;

function loadCuratorAssets() {
  if (curatorAssetsPromise) {
    return curatorAssetsPromise;
  }

  curatorAssetsPromise = CURATOR_ASSETS.reduce(
    (currentPromise, assetUrl) =>
      currentPromise.then(
        () =>
          new Promise((resolve, reject) => {
            const selector = assetUrl.endsWith(".js")
              ? `script[src="${assetUrl}"]`
              : `link[href="${assetUrl}"]`;
            const existingAsset = document.querySelector(selector);

            if (existingAsset) {
              resolve();
              return;
            }

            const asset = assetUrl.endsWith(".js")
              ? document.createElement("script")
              : document.createElement("link");

            asset.onload = resolve;
            asset.onerror = reject;

            if (asset.tagName === "SCRIPT") {
              asset.async = true;
              asset.charset = "UTF-8";
              asset.src = assetUrl;
            } else {
              asset.rel = "stylesheet";
              asset.href = assetUrl;
            }

            document.head.appendChild(asset);
          }),
      ),
    Promise.resolve(),
  );

  return curatorAssetsPromise;
}

function InstagramFeed() {
  useEffect(() => {
    let isCancelled = false;

    const feedContainer = document.getElementById(FEED_CONTAINER_ID);
    if (feedContainer) {
      feedContainer.className = "";
      feedContainer.innerHTML = CURATOR_BRAND_LINK;
    }

    loadCuratorAssets()
      .then(() => {
        if (isCancelled || !window.Curator) {
          return;
        }

        window.Curator.loadWidget(CURATOR_CONFIG, CURATOR_COLOURS, {});
      })
      .catch(() => {
        if (feedContainer && !isCancelled) {
          feedContainer.innerHTML = CURATOR_BRAND_LINK;
        }
      });

    return () => {
      isCancelled = true;
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
