import { useForm, ValidationError } from "@formspree/react";
import "./ContactView.css";

function ContactView() {
  const [state, handleSubmit] = useForm("xaqkeodg");

  return (
    <section id="contact" className="view">
      <div className="section-heading">
        <p className="eyebrow">Contact</p>
        <h2>Reach out about partnerships, events, or questions.</h2>
      </div>

      <div className="contact-container">
        {state.succeeded ? (
          <div className="contact-form contact-form-success" role="status">
            <h3>Thanks for reaching out.</h3>
            <p>
              Your message has been sent. We will get back to you as soon as we
              can.
            </p>
          </div>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit}>
            <h3>Get in touch</h3>

            <input
              type="hidden"
              name="_subject"
              value="New Keep Birch Lake Beautiful contact message"
            />

            <label htmlFor="contact-name">
              Name
              <input
                id="contact-name"
                type="text"
                name="name"
                placeholder="Your name"
                required
              />
            </label>
            <ValidationError
              className="contact-form-error"
              field="name"
              errors={state.errors}
            />

            <label htmlFor="contact-email">
              Email
              <input
                id="contact-email"
                type="email"
                name="email"
                placeholder="you@example.com"
                required
              />
            </label>
            <ValidationError
              className="contact-form-error"
              field="email"
              errors={state.errors}
            />

            <label htmlFor="contact-message">
              Message
              <textarea
                id="contact-message"
                name="message"
                rows="6"
                placeholder="Tell us what you have in mind."
                required
              />
            </label>
            <ValidationError
              className="contact-form-error"
              field="message"
              errors={state.errors}
            />
            <ValidationError
              className="contact-form-error"
              errors={state.errors}
            />

            <button type="submit" disabled={state.submitting}>
              {state.submitting ? "Sending..." : "Send message"}
            </button>
          </form>
        )}

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
