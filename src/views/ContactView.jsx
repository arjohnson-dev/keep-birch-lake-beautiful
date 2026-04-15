function ContactView() {
  return (
    <section id="contact" className="view">
      <div className="section-heading">
        <p className="eyebrow">Contact</p>
        <h2>Reach out about partnerships, events, or questions.</h2>
      </div>

      <div className="contact-container">
        <form className="contact-form">
          <h3>Get in touch</h3>

          <label>
            Name
            <input type="text" name="name" placeholder="Your name" />
          </label>

          <label>
            Email
            <input type="email" name="email" placeholder="you@example.com" />
          </label>

          <label>
            Message
            <textarea
              name="message"
              rows="6"
              placeholder="Tell us what you have in mind."
            />
          </label>

          <button type="submit">Send message</button>
        </form>

        <div className="contact-info">
          <h3>Contact details</h3>
          <div className="contact-details">
            <div className="contact-item">
              <span className="contact-label">Email</span>
              <a href="mailto:keepbirchlakebeautiful@gmail.com">
                keepbirchlakebeautiful@gmail.com
              </a>
            </div>
            <div className="contact-item">
              <span className="contact-label">Phone</span>
              <a href="tel:5748071924">(574) 807-1924</a>
            </div>
            <div className="contact-item">
              <span className="contact-label">Coy Jankowski</span>
              <a href="tel:5742984067">(574) 298-4067</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactView;
