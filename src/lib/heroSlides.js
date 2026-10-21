const CONSULTATION_ID = "immigration-lawyer-consultation";

// Insert into the resolved CMS slides so published content keeps its order.
export function withConsultationSlide(slides = [], bookingHref) {
  if (!slides.length) return slides;
  const existing = slides.find(slide => slide.id === CONSULTATION_ID);
  const original = slides.filter(slide => slide.id !== CONSULTATION_ID);
  const consultation = existing || {
    id: CONSULTATION_ID,
    headline: "Have Questions About Your ",
    highlight: "Immigration Journey?",
    description: "Get Special Assistance from Our Immigration Lawyer",
    cta: { label: "Book Your Consultation Today", href: bookingHref },
    images: [
      { src: "/consultation/law-1.jpg", alt: "Immigration legal consultation" },
      { src: "/consultation/law-2.jpg", alt: "Legal advice and immigration support" },
      { src: "/consultation/law-3.jpg", alt: "Professional immigration legal services" },
    ],
    imageDurationMs: 3000,
  };
  return [...original.slice(0, 1), consultation, ...original.slice(1)];
}
