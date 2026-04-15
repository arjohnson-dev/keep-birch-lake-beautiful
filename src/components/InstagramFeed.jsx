import { useEffect } from 'react'

const CURATOR_SCRIPT_SRC =
  'https://cdn.curator.io/published/700445c7-929f-427d-9c57-e7be427a6113.js'
const FEED_CONTAINER_ID = 'curator-feed-default-feed-layout'

function InstagramFeed() {
  useEffect(() => {
    const existingScript = document.querySelector(`script[src="${CURATOR_SCRIPT_SRC}"]`)
    if (existingScript) {
      existingScript.remove()
    }

    const feedContainer = document.getElementById(FEED_CONTAINER_ID)
    if (feedContainer) {
      feedContainer.innerHTML =
        '<a href="https://curator.io" target="_blank" rel="noreferrer" class="crt-logo crt-tag">Powered by Curator.io</a>'
    }

    const script = document.createElement('script')
    script.async = true
    script.charset = 'UTF-8'
    script.src = CURATOR_SCRIPT_SRC
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  return (
    <section className="instagram-section" aria-label="Instagram feed">
      <div className="instagram-feed-shell">
        <div id={FEED_CONTAINER_ID}>
          <a
            href="https://curator.io"
            target="_blank"
            rel="noreferrer"
            className="crt-logo crt-tag"
          >
            Powered by Curator.io
          </a>
        </div>
      </div>
    </section>
  )
}

export default InstagramFeed
