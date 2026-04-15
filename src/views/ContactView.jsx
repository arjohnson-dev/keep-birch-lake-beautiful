function ContactView() {
  return (
    <section id="contact" className="view">
      <div className="section-heading">
        <p className="eyebrow">Contact</p>
        <h2>Reach out about partnerships, events, or questions.</h2>
      </div>

      <form className="contact-form">
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
    </section>
  )
}

export default ContactView
