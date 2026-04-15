import { useEffect } from "react";
import { useCart } from "../context/CartContext.jsx";

function ThankYouView() {
  const { clearCart } = useCart();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("session_id")) {
      clearCart();
    }
  }, [clearCart]);

  return (
    <section id="thank-you" className="view">
      <div className="section-heading">
        <p className="eyebrow">Thank You</p>
        <h2>Your order is confirmed.</h2>
        <p>
          Thank you for supporting Keep Birch Lake Beautiful. A full order summary
          can be shown here in a later phase.
        </p>
      </div>
    </section>
  );
}

export default ThankYouView;
