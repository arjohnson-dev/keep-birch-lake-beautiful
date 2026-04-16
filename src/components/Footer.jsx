import "./Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>&copy; {currentYear} Keep Birch Lake Beautiful</p>
        <a href="https://arjohnson.dev/" target="_blank" rel="noreferrer">
          Developed by arjohnson.dev
        </a>
      </div>
    </footer>
  )
}

export default Footer
