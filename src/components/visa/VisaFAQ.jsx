import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div className={`vcp-faq-item${isOpen ? " open" : ""}`}>
      <button type="button" className="vcp-faq-question" onClick={onToggle} aria-expanded={isOpen}>
        <span>{faq.question}</span>
        <ChevronDown size={18} className="vcp-faq-chevron" />
      </button>
      {isOpen && <p className="vcp-faq-answer">{faq.answer}</p>}
    </div>
  );
}

export default function VisaFAQ({ faqs }) {
  const [openIndex, setOpenIndex] = useState(null);
  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="vcp2-section" id="faq">
      <div className="svc-section-heading">
        <h2>Frequently Asked Questions</h2>
      </div>
      <div className="vcp-faq-grid">
        {faqs.map((faq, index) => (
          <FAQItem
            key={index}
            faq={faq}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
      </div>
    </section>
  );
}
