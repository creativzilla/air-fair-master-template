// Hardcoded fallback content in CMS document shape.
//
// This is the exact content that was imported into Supabase (migration
// 20260926130000_cms_seed_content.sql). The website renders it while the
// published content is loading for the first time, or if Supabase cannot be
// reached, so no section is ever blank. Built from the existing data files in
// src/lib so there is still a single place for each piece of content.
import { immigrationServices } from "./immigrationServices.js";
import { visaCountryList } from "./visaCountries.js";
import { VISA_REGIONS } from "./visaDestinations.js";
import { travelDestinations, travelPackages, homepageTravelPackages, getTravelPackage } from "./travelDestinations.js";
import { stories, guides } from "./news.js";
import { articleContent } from "./newsArticleContent.js";

const img = (src, alt = "") => ({ src, alt, mediaId: null });
const link = (label, href) => ({ label, href });
const PRIVACY_CONSENT = { required: true, text: "I agree to the processing of my personal data in accordance with the Privacy Policy.", linkLabel: "Privacy Policy", linkHref: "/#contact" };

const docs = []; // { kind, slug, title, sort, content, formSlug? }
const add = (kind, slug, title, sort, content, formSlug = null) => docs.push({ kind, slug, title, sort, content, formSlug });

// ---------------------------------------------------------------- global
add("global", "site", "Site-wide (header, footer, shared blocks)", 0, {
  logo: img("/airfair-logo.png", "Air Fair Travel & Immigration"),
  logoLight: img("/airfair-logo-white.png", "Air Fair Travel & Immigration"),
  nav: {
    items: [
      { label: "Home", href: "/#top", highlight: false },
      { label: "Our Services", href: "/#our-services", highlight: false },
      { label: "Free Assessment", href: "/#assessment", highlight: false },
      { label: "Visa & Immigration", href: "/#our-services", highlight: true },
      { label: "About Us", href: "/#about", highlight: false },
      { label: "Contact", href: "/#contact", highlight: false },
    ],
    ctaLabel: "Book Now", ctaHref: "/#contact",
    searchPlaceholder: "Search visa and immigration services",
  },
  footer: {
    blurb: "Your trusted travel partner and visa consultant for unforgettable journeys and hassle-free immigration services.",
    columns: [
      { heading: "COMPANY", links: [link("About Us", "#about"), link("Our Team", "#about"), link("Careers", "#our-services"), link("Blog", "#about"), link("Contact Us", "#contact")] },
      { heading: "VISA SERVICES", links: [link("Tourist Visa", "#our-services"), link("9G Work Visa", "#our-services"), link("13A Marriage Visa", "#our-services"), link("SRRV / Retirement", "#our-services"), link("ACR-I Card", "#our-services"), link("Other Services", "#our-services")] },
    ],
    contactHeading: "CONTACT US",
    newsletter: { heading: "SUBSCRIBE TO OUR NEWSLETTER", body: "Get the latest updates and travel deals.", placeholder: "Your email address", thanks: "Thanks for subscribing!" },
    copyright: "© 2025 Air Fair Travel and Tours OPC. All rights reserved.",
    legalText: "Privacy Policy　 Terms & Conditions",
  },
  shared: {
    immigrationHelpCta: {
      heading: "Need More Help?",
      body: "Not sure if this is the right immigration service for you? Our team is here to help.",
      primaryCta: link("Talk to Our Immigration Team", "/#contact"),
      secondaryCta: link("View All Immigration Services", "/philippine-immigration-services"),
    },
    supportCard: {
      heading: "Need Help?",
      visaDescription: "Talk to our travel specialists for faster assistance.",
      travelDescription: "Talk to our travel specialists for personalized assistance.",
      cta: link("Contact Us", "/#contact"),
    },
    labels: {
      eligibilityHeading: "Who Is This For?",
      eligibilitySubtext: "This service is for foreign nationals who:",
      assistanceHeading: "How Airfair Can Help",
      assistanceSubtext: "We provide end-to-end assistance to make the process smoother for you.",
      whyChooseHeading: "Why Choose Airfair?",
      requirementsHeading: "Requirements",
      faqHeading: "Frequently Asked Questions",
      visaAboutPrefix: "About the",
      packageAboutPrefix: "About",
      packageHighlightsHeading: "Package Highlights",
      whatsIncludedHeading: "What's Included",
      relatedCtaFallback: "Learn More",
      visaCardCta: "View Requirements",
      tourCardCta: "View Package",
      breadcrumbHome: "Home",
      breadcrumbServices: "Services",
      breadcrumbImmigration: "Philippine Immigration Services",
      breadcrumbVisa: "Visa Assistance",
      breadcrumbTravel: "Travel and Tours",
      breadcrumbNews: "News & Current Events",
      requirementsIntro: "Prepare the following documents to apply for a {title}. Requirements may vary depending on your situation. Our team will guide you with the latest embassy guidelines.",
      packageHighlightsViewAll: "View All Highlights →",
    },
    chatBubbleLabel: "Contact Air Fair",
  },
});

// ---------------------------------------------------------------- pages
const section = (key, label, fields, visible = true) => ({ key, label, visible, fields });

const homeSections = [
  section("hero", "Hero slider", {
    flagLabel: "PHILIPPINES 🇵🇭",
    featureIcons: ["shield-check", "file-check", "users"],
    slides: [
      { tag: "Immigration Services", icon: "stamp", headline: "Philippine ", highlight: "Immigration Services", subheading: "Your trusted partner for every visa journey.", description: "Visa, residency, citizenship, documentation, and immigration compliance — handled end-to-end by accredited consultants.", features: ["Government-Accredited", "End-to-End Processing", "Trusted by Thousands"], cta: link("Explore Immigration Services", "/philippine-immigration-services"),
        images: ["photo-1563463149242-bd378d9ab05c", "photo-1750941416707-4dff777c67b1", "photo-1581553673739-c4906b5d0de8", "photo-1715927134295-6b1016e28414"] },
      { tag: "Most Requested", icon: "landmark", headline: "Special Resident ", highlight: "Retiree's Visa", subheading: "Retire where the tropics feel like home.", description: "Live in the Philippines permanently — unlimited travel, no annual reporting, and government discounts.", features: ["Lifetime Residency", "PRA-Accredited Process", "Trusted by Retirees"], cta: link("Start Your SRRV Application", "/philippine-immigration-services/special-resident-retirees-visa"),
        images: ["photo-1710917554876-9e2ada25f7b4", "photo-1749468373693-a857cdb4579e", "photo-1546068996-8da61faeceaa", "photo-1771533679889-fa1bf5df299a"] },
      { tag: "Visa Assistance", icon: "plane", headline: "International Tourist ", highlight: "Visa Assistance", subheading: "Travel the world with confidence.", description: "Schengen, US, UK, Canada, and Japan — we make the tourist visa application process clearer, from requirements to submission.", features: ["Expert Application Support", "Multiple Destinations", "Clear Requirements Checklist"], cta: link("Get Visa Assistance", "#visa-assistance"),
        images: ["photo-1765707886539-6d57024ddc2f", "photo-1566800890932-e89159daf3dc", "photo-1696283201322-04ef0aef3c54", "photo-1549813069-a5f8c1dce35f"] },
      { tag: "Travel & Tours", icon: "globe", headline: "Travel & ", highlight: "Tours", subheading: "Discover amazing destinations, hassle-free.", description: "Curated travel packages across Asia — from Kuala Lumpur to Jeju Island, with everything handled for you.", features: ["Curated Packages", "Hassle-Free Travel", "Unforgettable Experiences"], cta: link("Explore Travel Packages", "/travel-tours"),
        images: ["photo-1529510021255-4a1179e99095", "photo-1761141954476-2921e2e43e99", "photo-1746872269585-d85a03ef2ad2", "photo-1744705221117-9c726f9497b0"] },
    ].map(s => ({ ...s, images: s.images.map(id => img(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`)) })),
    trustLabel: "Your Trusted Visa & Immigration Partner",
    trustItems: [{ icon: "plane", label: "Travel" }, { icon: "users", label: "Family" }, { icon: "compass", label: "Opportunity" }, { icon: "heart", label: "A Brighter Tomorrow" }],
  }),
  section("accreditations", "Accreditation bar", {
    label: "Officially Accredited By",
    itemSubLabel: "Republic of the Philippines",
    items: [
      { logo: img("/dole-logo-v2.png", "Department of Labor and Employment"), label: "Department of Labor and Employment" },
      { logo: img("/bi-logo-v2.png", "Bureau of Immigration"), label: "Bureau of Immigration" },
      { logo: img("/pra-logo-v2.png", "Philippine Retirement Authority"), label: "Philippine Retirement Authority" },
      { logo: img("/dot-logo.png", "Department of Tourism"), label: "Department of Tourism" },
    ],
  }),
  section("categories", "Service categories", {
    linkLabel: "View Services",
    items: [
      { title: "Philippine Immigration Services", description: "Visa, residency, citizenship, documentation, and immigration compliance services.", icon: "stamp", href: "/philippine-immigration-services", theme: "green" },
      { title: "Special Resident Retiree's Visa (SRRV)", description: "Live, retire, and enjoy long-term residency in the Philippines.", icon: "landmark", href: "/philippine-immigration-services/special-resident-retirees-visa", theme: "amber" },
      { title: "International Tourist Visa Assistance", description: "Travel with confidence. Aitfair helps make the tourist visa application process clearer.", icon: "plane", href: "/visa-assistance/international-tourist-visa", theme: "blue" },
      { title: "Travel & Tours", description: "Discover amazing destinations with our carefully curated travel packages.", icon: "globe", href: "/travel-tours", theme: "teal" },
    ],
  }),
  section("immigration", "Philippine Immigration Services", {
    heading: "Philippine Immigration Services",
    body: "Reliable end-to-end immigration assistance in the Philippines. Our experienced team helps you navigate the process with clarity, compliance, and confidence.",
    note: "Cards come from Services → Immigration (items with 'Show on homepage').",
  }),
  section("srrv", "SRRV banner", {
    image: img("/srrv-retire-paradise-2.png", "Retire in Paradise — SRRV Assistance"),
    heading: "Special Resident Retiree's Visa (SRRV)",
    subheading: "Retire and enjoy long-term residency in the Philippines with expert guidance.",
    description: "We help qualified foreign nationals and former Filipino citizens process their SRRV application with a smooth, hassle-free experience — from document preparation and requirements checklists to filing with the Philippine Retirement Authority and post-approval support.",
    benefits: [
      { icon: "home", text: "Long-term residency privileges" },
      { icon: "plane", text: "Multiple-entry travel benefits" },
      { icon: "arrow-right", text: "Easy re-entry to the Philippines" },
      { icon: "file-check-2", text: "Reduced documentation requirements" },
      { icon: "users", text: "Access to certain benefits and privileges" },
    ],
    primaryCta: link("Free Consultation", "/philippine-immigration-services/special-resident-retirees-visa#assessment-form"),
    secondaryCta: link("Learn More", "/philippine-immigration-services/special-resident-retirees-visa"),
  }),
  section("visa", "International Tourist Visa Assistance", {
    heading: "International Tourist Visa Assistance",
    description: "Explore the world with confidence. We'll help you with the application process, requirements, and guidance.",
    viewAll: link("View All Destinations →", "/visa-assistance/international-tourist-visa"),
    cardIcon: img("/visa-icon.png"),
    note: "Cards come from Services → Visa destinations marked 'Featured'.",
  }),
  section("travel", "Travel & Tours", {
    heading: "Travel & Tours",
    description: "Discover amazing destinations with our carefully curated travel packages. Unforgettable experiences, hassle-free travel.",
    viewAll: link("View All Travel Packages →", "/travel-tours"),
    cardIcon: img("/travel-tours-icon.png"),
    cardCtaLabel: "View Package",
    note: "Cards come from Services → Travel packages with 'Show on homepage'.",
  }),
  section("trustBar", "Trust bar", {
    items: [
      { icon: "shield-check", title: "Government Accredited", text: "PRA, BI & DOLE accredited" },
      { icon: "users", title: "Experienced Consultants", text: "Specialists you can trust" },
      { icon: "heart", title: "Personalized Guidance", text: "Tailored to your unique goals" },
      { icon: "zap", title: "Fast & Reliable Support", text: "We're here whenever you need us" },
    ],
  }, false), // currently not rendered on the homepage
  section("assessment", "Free assessment", {
    headingLine1: "Not sure which visa",
    headingAccent: "you need?",
    body: "Tell us where you want to go and what you need. Our team will help you understand the next steps.",
    primaryCta: link("Get an Assessment", "#contact"),
    secondaryCta: link("Explore visa services", "/visa-assistance/international-tourist-visa"),
    trustItems: [{ icon: "shield-check", label: "Clear guidance" }, { icon: "file-check", label: "Personalized checklist" }, { icon: "users", label: "Support from start to finish" }],
    steps: [
      { icon: "message-circle", title: "Tell us your plans", text: "Share your destination and goals." },
      { icon: "file-check", title: "Get your checklist", text: "Know the documents and next steps." },
      { icon: "users", title: "Move forward with support", text: "Get guidance through the process." },
    ],
  }),
  section("testimonials", "Testimonials", {
    heading: "Trusted by travelers and families alike.", // overwritten from content_blocks in SQL
    subheading: "Real stories from clients we've guided through their visa and immigration journey.",
    fallbackCategory: "Air Fair Client",
    stats: { clientsValue: "+2,500", clientsLabel: "Happy Clients", avatarInitials: ["MC", "JR", "AC"], ratingValue: "4.9/5", ratingLabel: "Average Rating" },
    tagline: "JOURNEYS TO A BRIGHTER TOMORROW",
    note: "Cards come from Testimonials.",
  }),
  section("news", "News & current events", {
    heading: "News & Current Events",
    body: "Fresh perspectives on travel, tourism, and immigration to keep you connected.",
    viewAll: link("View all news", "/news"),
    cardCtaLabel: "Learn more",
    note: "Curated news and travel resources. Read each article for details and source links.",
  }),
  section("contact", "Contact", {
    heading: "Ready to make your travel dreams a reality?",
    body: "Tell us what you need and our travel experts will get back to you with the best next step.",
    formKey: "website-contact",
  }),
];
add("page", "home", "Home", 0, { seo: { title: "", description: "", note: "Homepage title comes from Settings → SEO" }, sections: homeSections });

add("page", "immigration-hub", "Philippine Immigration Services", 1, {
  seo: { title: "Philippine Immigration Services | {businessName}", description: "" },
  sections: [
    section("hero", "Hero", {
      heading: "Philippine Immigration Services",
      subheading: "Clear guidance and professional assistance for your Philippine immigration needs.",
      description: "From visa applications and extensions to ACR I-Card assistance and permanent residency, Airfair helps make the immigration process easier to understand and manage.",
      primaryCta: link("Explore Immigration Services", "#services"),
      secondaryCta: link("Talk to Our Team", "/#contact"),
      image: img("https://images.unsplash.com/photo-1563463149242-bd378d9ab05c?auto=format&fit=crop&w=1200&q=80", "Bureau of Immigration, Republic of the Philippines"),
    }),
    section("about", "About", {
      image: img("https://images.unsplash.com/photo-1544396821-4dd40b938ad3?auto=format&fit=crop&w=1200&q=80", "Passport and travel documents"),
      heading: "Philippine Immigration Services",
      paragraphs: [
        "Navigating immigration requirements can involve multiple documents, processes, and government procedures. Airfair provides assistance for individuals, families, retirees, travelers, and foreign nationals who need support with Philippine visa and immigration-related services.",
        "Our team helps guide clients through the required steps, documentation, and application process so they can move forward with greater clarity and convenience.",
      ],
    }),
    section("services", "Services grid", {
      heading: "Immigration Services",
      description: "Explore our range of Philippine immigration services and find the assistance that matches your needs.",
      cardLinkLabel: "Learn More",
      note: "Cards come from Services → Immigration (items with 'Show on hub').",
    }),
    section("why", "Why choose Airfair", {
      heading: "Why Choose Airfair?",
      description: "Immigration processes can feel complicated. We help make each step easier to understand and manage.",
      items: [
        { icon: "users", title: "Clear Guidance", description: "Understand the requirements and next steps before moving forward." },
        { icon: "file-text", title: "Document Assistance", description: "Get guidance in preparing the documents needed for your application." },
        { icon: "heart", title: "Personalized Support", description: "Every situation is different, so assistance is based on your specific requirements." },
        { icon: "clock", title: "Convenient Process", description: "Our team helps coordinate the process so you can focus on what matters most." },
      ],
    }),
    section("cta", "Final call to action", {
      heading: "Need Help With Your Immigration Requirements?",
      body: "Tell us what immigration service you need, and our team will help you understand the next steps.",
      primaryCta: link("Get Immigration Assistance", "/#contact"),
      secondaryCta: link("Contact Airfair", "/#contact"),
    }),
  ],
});

add("page", "visa-hub", "International Tourist Visa Assistance", 2, {
  seo: { title: "", description: "" },
  sections: [
    section("hero", "Hero", {
      breadcrumbParent: link("Visa Assistance", "/#visa-assistance"),
      breadcrumbCurrent: "International Tourist Visa",
      heading: "International Tourist Visa Assistance",
      description: "Explore the world with confidence. We'll help you with the application process, requirements, and guidance for your chosen destination.",
      primaryCta: link("Explore Destinations", "#destinations"),
      secondaryCta: link("Talk to Our Visa Team", "/#contact"),
      trustPoints: ["Trusted Guidance", "Hassle-Free Process", "More Travel Possibilities"],
      image: img("https://images.unsplash.com/photo-1765707886539-6d57024ddc2f?auto=format&fit=crop&w=1200&q=80", "Traveler with passport and luggage at the airport"),
    }),
    section("destinations", "Destinations", {
      heading: "Where Are You Planning to Travel?",
      description: "Browse popular destinations and get visa assistance for your next journey.",
      searchPlaceholder: "Search destination (e.g. Japan, Canada, Schengen)...",
      regions: VISA_REGIONS,
      emptyText: "No destinations found. Try another search or check back soon.",
    }),
    section("cantFind", "Can't find your destination", {
      heading: "Can't find your destination?",
      body: "We assist with tourist visas to many other countries. Get in touch and we'll guide you.",
      cta: link("Contact Us", "/#contact"),
    }),
  ],
});

add("page", "travel-hub", "Travel & Tours", 3, {
  seo: { title: "Travel & Tours Packages | {businessName}", description: "" },
  sections: [
    section("hero", "Hero", {
      heading: "Travel & Tours Packages",
      description: "Explore amazing destinations, customized travel packages, and hassle-free arrangements. We handle the details, so you can focus on making unforgettable memories.",
      primaryCta: link("Explore Destinations", "#destinations"),
      secondaryCta: link("Talk to Our Travel Team", "/#contact"),
      trustPoints: [{ icon: "plane", label: "Trusted Travel Partner" }, { icon: "briefcase", label: "Hassle-Free Process" }, { icon: "headset", label: "Tailored Packages" }],
    }),
    section("search", "Search bar", {
      destinationPlaceholder: "Search destination (e.g. Japan, Bali, Singapore)",
      dateLabel: "Travel Date",
      travelersLabel: "Travelers",
      travelerOptions: ["1 Traveler", "2 Travelers", "3 Travelers", "4 Travelers", "5+ Travelers"],
      buttonLabel: "Search Packages",
    }),
    section("destinations", "Popular destinations", {
      viewAll: link("View All Destinations →", "/travel-tours"),
      heading: "Popular Destinations",
      description: "Explore our most in-demand travel destinations.",
      emptyText: "No destinations found. Try another search.",
    }),
    section("featured", "Featured packages", {
      viewAll: link("View All Packages →", "/travel-tours"),
      heading: "Featured Travel Packages",
      description: "Handpicked packages for your next adventure.",
    }),
    section("promoBanner", "Promo banner", {
      image: img("/travel-promo-leaderboard.jpg", "Exclusive travel promo — up to 30% off. Book your trip."),
      href: "/#contact",
    }),
  ],
});

add("page", "news", "News & Current Events", 4, {
  seo: { title: "News & Current Events | Air Fair", description: "" },
  sections: [
    section("hero", "Heading", { heading: "Stories worth exploring.", body: "Travel, tourism, and immigration updates to help you go further." }),
    section("filters", "Category filters", { categories: ["All updates", "Travel & Events", "Immigration", "Tourism News"] }),
    section("latest", "More stories", { heading: "More stories & travel resources", note: "Curated news and travel resources. Read each article for details and source links." }),
    section("contact", "Contact strip", { heading: "Stay informed, travel with confidence.", body: "Have a question about your next journey? Our team is here to help.", cta: link("Talk to our team", "/#contact") }),
    section("article", "Article page template", {
      figcaption: "Illustrative destination imagery from the Air Fair journal.",
      travelersHeading: "What this means for travelers",
      takeawaysHeading: "Key takeaways",
      aheadHeading: "Looking ahead",
      sourceHeading: "Source & further reading",
      sourceLinkLabel: "Visit source website",
      shareHeading: "Share this article",
      backLabel: "Back to all news",
      tocHeading: "In this article",
      exploreHeading: "Explore more",
      exploreLinks: [link("News & Events", "/news"), link("Travel packages", "/travel-tours"), link("Visa assistance", "/visa-assistance/international-tourist-visa")],
      help: { heading: "Plan your next journey", body: "Get guidance on travel, visa assistance, and your next adventure.", cta: link("Book a consultation", "/#contact") },
      relatedHeading: "More stories you may like",
      notFound: "Article not found",
    }),
  ],
});

// ---------------------------------------------------------------- forms
const stripIds = fields => fields.map(({ id, ...rest }) => rest);

let formSort = 0;
add("form", "website-contact", "Form — Website contact", formSort++, {
  title: "", description: "", layout: "contact",
  submitLabel: "Send Inquiry", privacyNote: "", consent: null,
  successTitle: "Thank you for reaching out.", successMessage: "We've received your inquiry and will contact you soon.",
  sections: [{ id: "main", title: "", fields: [
    { name: "name", label: "Full name", type: "text", required: true, placeholder: "Full name" },
    { name: "email", label: "Email address", type: "email", required: true, placeholder: "Email address" },
    { name: "phone", label: "Phone number", type: "tel", required: false, placeholder: "Phone number" },
    { name: "message", label: "How can we help?", type: "textarea", required: false, placeholder: "How can we help?" },
  ] }],
});

// Visa: every country must share the same inquiry fields
const visaFields = visaCountryList[0].inquiryForm.fields;
add("form", "visa-inquiry", "Form — Visa inquiry (all destinations)", formSort++, {
  title: "Apply for {title}", description: "Let our team assist you. Fill out the form below and we'll get in touch with you shortly.",
  layout: "grid", submitLabel: "Submit Inquiry", privacyNote: "Your information is safe with us.", consent: PRIVACY_CONSENT,
  successTitle: "Inquiry Submitted",
  successMessage: "Thank you for your interest in the {title}. Our team will review your inquiry and reach out with the next steps.",
  successActions: [link("Explore More Destinations", "/visa-assistance/international-tourist-visa"), link("Contact Airfair", "/#contact")],
  sections: [{ id: "main", title: "", fields: visaFields }],
});

// Travel: all packages (full + offers) must share the same fields
const allPackageSlugs = [...travelPackages.map(p => p.slug), ...homepageTravelPackages.map(p => p.slug)];
const travelFields = getTravelPackage(allPackageSlugs[0]).inquiryForm.fields;
add("form", "travel-inquiry", "Form — Travel package inquiry (all packages)", formSort++, {
  title: "Inquire About This Package", description: "Fill out the form below and our travel specialists will get in touch with you shortly.",
  layout: "grid", submitLabel: "Submit Inquiry", privacyNote: "Your information is safe with us.", consent: PRIVACY_CONSENT,
  successTitle: "Inquiry Submitted",
  successMessage: "Thank you for your interest in {title}. Our travel specialists will review your inquiry and reach out with the next steps.",
  successActions: [link("Explore More Packages", "/travel-tours"), link("Contact Airfair", "/#contact")],
  sections: [{ id: "main", title: "", fields: travelFields }],
});

// ---------------------------------------------------------------- immigration services
const HUB_ORDER = ["13a-immigrant-visa", "9g-working-visa", "tourist-visa-extension", "acr-i-card", "special-non-immigrant-visa", "naturalization", "deportation-assistance", "visa-reconsideration", "consultation"];
const CARD = {
  "13a-immigrant-visa": ["For foreign spouses of Filipino citizens.", "heart", "heart"],
  "9g-working-visa": ["Immigration assistance for foreign nationals working in the Philippines.", "briefcase-outline", "briefcase"],
  "tourist-visa-extension": ["Assistance for extending your authorized stay in the Philippines.", "ticket", "plane"],
  "acr-i-card": ["Assistance with Alien Certificate of Registration requirements.", "id-card", "id-card"],
  "special-non-immigrant-visa": ["Support for applicable special non-immigrant visa applications.", "file-check", "file-check"],
  naturalization: ["Guidance for eligible foreign nationals seeking Philippine citizenship.", "landmark", "landmark"],
  "deportation-assistance": ["Support and guidance for immigration-related deportation matters.", "shield-check", "shield-check"],
  "visa-reconsideration": ["Assistance involving immigration petitions or reconsideration matters.", "gavel", "gavel"],
  consultation: ["Guidance for other immigration concerns and requirements.", "message-circle", "message-circle"],
};

Object.values(immigrationServices).forEach((svc, i) => {
  const { form, heroImage, aboutImage, ...rest } = svc;
  const onCards = HUB_ORDER.includes(svc.slug);
  const [desc, homeIcon, hubIcon] = CARD[svc.slug] || ["", "", ""];
  const formSlug = `immigration-${svc.slug}`;
  add("form", formSlug, `Form — ${svc.title}`, formSort++, {
    title: form.title || "Start Your Assessment",
    description: form.description || "",
    layout: "sections",
    submitLabel: form.submitLabel || "Submit for Assessment",
    privacyNote: form.privacyNote || "Your information is secure and will only be used to assist with your inquiry.",
    consent: null,
    successTitle: "Assessment Submitted",
    successMessage: "Thank you for providing your information. Our team will review your inquiry and contact you regarding the next steps.",
    successActions: [link("Return to Immigration Services", "/philippine-immigration-services"), link("Contact Airfair", "/#contact")],
    sections: form.sections.map(sec => ({ id: sec.id, title: sec.title, fields: stripIds(sec.fields) })),
  });
  add("immigration_service", svc.slug, svc.title, onCards ? HUB_ORDER.indexOf(svc.slug) : 100 + i, {
    ...rest,
    heroImage: img(heroImage, svc.title),
    aboutImage: aboutImage ? img(aboutImage, svc.aboutTitle || svc.title) : null,
    heroSecondaryCta: svc.heroSecondaryCta || "Talk to Our Team",
    card: { description: desc, homeIcon, hubIcon, showOnHome: onCards, showOnHub: onCards },
  }, formSlug);
});

// ---------------------------------------------------------------- visa destinations
visaCountryList.forEach((c, i) => {
  const { inquiryForm, featuredImage, gallery, relatedServices, ...rest } = c;
  add("visa_destination", c.slug, c.title, i, {
    ...rest,
    gallery: gallery.map(src => img(src)),
    relatedServices: relatedServices.map(r => ({ ...r, image: img(r.image) })),
    poster: img(`/visa-posters/${c.slug}.jpg`, `${c.title} promotional poster`),
  }, "visa-inquiry");
});

// ---------------------------------------------------------------- travel packages
travelPackages.forEach((p, i) => {
  const { inquiryForm, image, packageHighlights, relatedCard, ...rest } = p;
  add("travel_package", p.slug, p.title, i, {
    variant: "package", showOnHome: false, place: "", flagCode: "", name: p.title,
    ...rest,
    image: img(image, p.title),
    packageHighlights: packageHighlights.map(h => ({ ...h, image: img(h.image, h.title) })),
    relatedCard: relatedCard ? { ...relatedCard, image: img(relatedCard.image) } : null,
    poster: img(`/travel-posters/${p.slug}.jpg`, `${p.title} promotional poster`),
  }, "travel-inquiry");
});
homepageTravelPackages.forEach((offer, i) => {
  const full = getTravelPackage(offer.slug);
  const { inquiryForm, image, gallery, ...rest } = full;
  add("travel_package", offer.slug, offer.name, 100 + i, {
    variant: "offer", showOnHome: true, featured: false, duration: "", inclusions: [],
    ...rest,
    image: img(image, offer.name),
    gallery: gallery.map(src => img(src)),
    relatedCard: null,
    poster: img(`/travel-posters/${offer.slug}.jpg`, `${full.title} promotional poster`),
  }, "travel-inquiry");
});

travelDestinations.forEach((d, i) => {
  const { image, ...rest } = d;
  add("travel_destination", d.slug, d.name, i, { ...rest, image: img(image, d.name) });
});

// ---------------------------------------------------------------- news
stories.forEach((s, i) => {
  const { image, logo, ...rest } = s;
  add("news_article", s.slug, s.title, i, { type: "story", ...rest, image: img(image), logo: logo ? img(logo, s.source) : null, article: articleContent[s.slug] });
});
guides.forEach((g, i) => {
  const { image, ...rest } = g;
  add("news_article", g.slug, g.title, 100 + i, { type: "guide", date: "", dateTime: "", initials: "", ...rest, image: img(image), logo: null, article: articleContent[g.slug] || null });
});

// ---------------------------------------------------------------- testimonials fallback (used only if the live table has none)
const FALLBACK_TESTIMONIALS = [
  { clientName: "Maria Santos", quote: "Air Fair helped me get my Japan visa in just 2 weeks! Their preparation and support were professional and honest.", serviceCategory: "Tourist Visa", photo: null },
  { clientName: "James Reyes", quote: "They handled my 9G work visa from the employer paperwork to the BI interview. Smooth from start to finish.", serviceCategory: "9G Work Visa", photo: null },
  { clientName: "Ana Cruz", quote: "They processed my 13A marriage visa without any hassle. The team is knowledgeable, patient, and kept me updated throughout.", serviceCategory: "13A Visa", photo: null },
];

FALLBACK_TESTIMONIALS.forEach((t, i) => {
  add("testimonial", t.clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + (i + 1), t.clientName, i, t);
});

// Same row shape as public.cms_published (document_id/version_id are null
// because fallback content has no database identity).
export const FALLBACK_DOCS = docs.map(d => ({
  document_id: null,
  version_id: null,
  kind: d.kind,
  slug: d.slug,
  title: d.title,
  sort_order: d.sort,
  content: d.content,
}));
