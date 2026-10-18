// Centralized configuration for every Visa Assistance country/visa-type
// detail page.
//
// The page template (VisaCountryPage + its section components) never changes
// per country. To add a new destination or visa type, add ONE entry to this
// object — content, images, highlights, requirements, FAQs, related
// services, and the inquiry form schema. Nothing else needs to be touched.
//
// This is also the single source of truth for the destination "cards" shown
// on the homepage teaser and the /visa-assistance hub page — see
// lib/visaDestinations.js, which derives its data from this file.

function defaultHighlights() {
  return [
    { icon: "plane", title: "Tourism & Sightseeing", description: "Explore top destinations." },
    { icon: "users", title: "Visit Family & Friends", description: "Reconnect with loved ones." },
    { icon: "clock", title: "Short-Term Stay", description: "Typically a few weeks to months." },
    { icon: "briefcase", title: "Business & Events", description: "Meetings, conferences, and more." },
  ];
}

function baseInquiryFields() {
  return [
    { name: "fullName", label: "Full Name", type: "text", required: true, placeholder: "Enter your full name" },
    { name: "email", label: "Email Address", type: "email", required: true, placeholder: "Enter your email address" },
    { name: "phone", label: "Phone Number", type: "tel", required: true, placeholder: "+63 912 345 6789" },
    { name: "travelDate", label: "Date of Travel (Tentative)", type: "date", required: true },
    {
      name: "travelers",
      label: "Number of Travelers",
      type: "select",
      required: true,
      options: ["1 Traveler", "2 Travelers", "3 Travelers", "4 Travelers", "5+ Travelers"],
    },
    { name: "message", label: "Additional Message (Optional)", type: "textarea", required: false, placeholder: "Tell us more about your travel plans or questions." },
  ];
}

function defaultFaqs(country, stayAnswer) {
  return [
    {
      question: "How long is the processing time?",
      answer: `Processing time for the ${country.title} varies depending on the embassy or consulate and your specific application.`,
    },
    {
      question: "How long can I stay?",
      answer: stayAnswer || "Length of stay depends on the visa category and what is approved for your application.",
    },
    {
      question: "Is travel insurance required?",
      answer: "Travel insurance is not always mandatory, but it is recommended and may strengthen your application.",
    },
    {
      question: "Can I apply if I have visited this country before?",
      answer: "Yes. Previous travel does not disqualify you, and a good travel history can support your application.",
    },
    {
      question: "What happens if my application is denied?",
      answer: "You may be able to reapply after addressing the reasons for denial. Our team can help you review your case.",
    },
  ];
}

function relatedTravelCard(country, blurb) {
  return [
    {
      title: `Explore More of ${country.country}`,
      description: blurb,
      image: country.featuredImage,
      ctaLabel: "View Travel Packages",
      ctaHref: "/#travel-tours",
    },
  ];
}

export const visaCountries = {
  japan: {
    slug: "japan",
    country: "Japan",
    countryCode: "JP",
    flag: "jp",
    region: "Asia",
    featured: true,
    visaType: "Tourist Visa",
    title: "Japan Tourist Visa",
    hubTitle: "Japan Visa",
    hubDescription: "Explore Japan for tourism, culture, or business.",
    hubCta: "View Requirements",
    subtitle: "Explore Japan for tourism, culture, or business.",
    description:
      "Experience the beauty of Japan — from its rich culture and modern cities to breathtaking landscapes. We guide you with the latest requirements, helpful tips, and support throughout your application process.",
    featuredImage: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1600&q=80",
    aboutParagraphs: [
      "A Japan Tourist Visa (Temporary Visitor Visa) allows you to visit Japan for tourism, sightseeing, or to visit family and friends. Discover beautiful destinations, experience unique culture, and enjoy world-class attractions.",
    ],
    highlights: [
      { icon: "plane", title: "Tourism & Sightseeing", description: "Explore top destinations." },
      { icon: "users", title: "Visit Family & Friends", description: "Reconnect with loved ones." },
      { icon: "clock", title: "Short-Term Stay", description: "Usually up to 90 days." },
      { icon: "heart", title: "Amazing Experiences", description: "Culture, food, and more." },
    ],
    requirements: [
      {
        title: "Valid Passport",
        icon: "id-card",
        required: true,
        items: ["Must be valid for at least 6 months beyond your intended stay", "Must have at least 2 blank visa pages"],
      },
      {
        title: "Visa Application Form",
        icon: "file-text",
        required: true,
        items: ["Duly accomplished and signed application form"],
      },
      {
        title: "Recent Photos",
        icon: "file-check",
        required: true,
        items: ["4.5cm x 4.5cm, taken within the last 6 months", "Plain white background, no glasses or head coverings"],
      },
      {
        title: "Flight Itinerary",
        icon: "plane",
        required: true,
        items: ["Confirmed round-trip booking or reservation"],
        note: "A tentative or reserved itinerary is often accepted — you don't need to purchase your ticket until the visa is approved.",
      },
      {
        title: "Hotel Accommodation",
        icon: "home",
        required: true,
        items: ["Confirmed hotel booking for your entire stay", "Or an invitation letter if staying with family or friends"],
      },
      {
        title: "Proof of Financial Capacity",
        icon: "file-text",
        required: true,
        items: ["Bank certificate or bank statements (last 3 months)", "Income Tax Return (ITR) for self-employed applicants"],
      },
      {
        title: "Employment / School Documents",
        icon: "briefcase",
        required: false,
        items: ["Certificate of Employment and approved leave", "Business registration, if self-employed", "School registration, if a student"],
      },
      {
        title: "Other Supporting Documents",
        icon: "clipboard-check",
        required: false,
        items: ["Invitation letter, if visiting family or friends", "PSA documents, if applicable to your purpose of travel"],
      },
    ],
    faqs: [
      {
        question: "How long is the processing time?",
        answer: "Processing time varies depending on the embassy and your application, but it typically takes a few business days to a few weeks.",
      },
      {
        question: "How long can I stay in Japan?",
        answer: "Most tourist visas allow a stay of up to 15 or 30 days, depending on the type of visa approved.",
      },
      {
        question: "Is travel insurance required?",
        answer: "Travel insurance is not always mandatory for a Japan tourist visa, but it is highly recommended and may strengthen your application.",
      },
      {
        question: "Can I apply if I have been to Japan before?",
        answer: "Yes. Previous travel to Japan does not disqualify you, and a good travel history can support your application.",
      },
      {
        question: "What happens if my application is denied?",
        answer: "You may reapply after addressing the reasons for denial. Our team can help you review and strengthen your case.",
      },
    ],
    relatedServices: relatedTravelCard(
      { country: "Japan", featuredImage: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80" },
      "From Tokyo to Kyoto, Osaka to Hokkaido — we can help you plan your trip."
    ),
    inquiryForm: { fields: baseInquiryFields() },
    seo: {
      title: "Japan Tourist Visa Assistance | Airfair Travel and Tours",
      description: "Airfair helps you prepare the requirements and application process for your Japan Tourist Visa.",
    },
  },

  us: {
    slug: "us",
    country: "United States",
    countryCode: "US",
    flag: "us",
    region: "North America",
    featured: true,
    visaType: "Tourist Visa (B1/B2)",
    title: "US Tourist Visa",
    hubTitle: "US Visa",
    hubDescription: "Visit the USA for business, study or leisure.",
    hubCta: "View Requirements",
    subtitle: "Visit the USA for business, study, or leisure.",
    description:
      "From the DS-160 form to interview preparation, Airfair helps you understand the requirements and process for your US B1/B2 tourist visa application.",
    featuredImage: "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?auto=format&fit=crop&w=1600&q=80",
    aboutParagraphs: [
      "The US Tourist Visa (B1/B2) allows eligible travelers to visit the United States for tourism, visiting family, or short-term business purposes. Airfair helps you prepare your DS-160 application, documentation, and interview readiness.",
    ],
    highlights: defaultHighlights(),
    requirements: [
      { title: "Valid Passport", icon: "id-card", required: true, items: ["Valid for at least 6 months beyond your intended stay"] },
      { title: "DS-160 Confirmation Page", icon: "file-text", required: true, items: ["Completed online nonimmigrant visa application"] },
      { title: "Visa Application Fee Receipt", icon: "file-check", required: true, items: ["Proof of payment of the MRV fee"] },
      { title: "Photo", icon: "file-check", required: true, items: ["Recent photo meeting US visa photo requirements"] },
      {
        title: "Proof of Ties to Home Country",
        icon: "briefcase",
        required: true,
        items: ["Employment certificate, business documents, or property records"],
        note: "This helps demonstrate your intent to return home after your visit.",
      },
      { title: "Financial Documents", icon: "file-text", required: true, items: ["Bank statements or sponsorship documents showing sufficient funds"] },
    ],
    faqs: defaultFaqs({ title: "US Tourist Visa" }, "A B1/B2 visa is typically valid for up to 6 months per visit, for up to 10 years of multiple entries if approved."),
    relatedServices: relatedTravelCard(
      { country: "United States", featuredImage: "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?auto=format&fit=crop&w=800&q=80" },
      "From New York to Los Angeles, San Francisco to Orlando — let us help plan your trip."
    ),
    inquiryForm: { fields: baseInquiryFields() },
    seo: {
      title: "US Tourist Visa (B1/B2) Assistance | Airfair Travel and Tours",
      description: "Airfair helps you prepare the DS-160, documentation, and interview readiness for your US tourist visa.",
    },
  },

  uk: {
    slug: "uk",
    country: "United Kingdom",
    countryCode: "GB",
    flag: "gb",
    region: "Europe",
    featured: true,
    visaType: "Standard Visitor Visa",
    title: "UK Standard Visitor Visa",
    hubTitle: "UK Visa",
    hubDescription: "Discover new opportunities in the United Kingdom.",
    hubCta: "View Requirements",
    subtitle: "Discover new opportunities in the United Kingdom.",
    description: "Airfair helps you understand the requirements and application process for your UK Standard Visitor Visa, from documentation to submission.",
    featuredImage: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=80",
    aboutParagraphs: [
      "The UK Standard Visitor Visa allows travelers to visit the United Kingdom for tourism, visiting family, or short-term business. Airfair assists in preparing your online application and supporting documents.",
    ],
    highlights: defaultHighlights(),
    requirements: [
      { title: "Valid Passport", icon: "id-card", required: true, items: ["Valid for the duration of your intended stay"] },
      { title: "Online Application Form", icon: "file-text", required: true, items: ["Completed UK visa online application"] },
      { title: "Proof of Accommodation", icon: "home", required: true, items: ["Hotel booking or invitation letter from your host"] },
      { title: "Bank Statements", icon: "file-text", required: true, items: ["Recent bank statements showing sufficient funds"] },
      { title: "Travel Itinerary", icon: "plane", required: true, items: ["Flight booking or reservation"] },
      { title: "Proof of Employment / Study", icon: "briefcase", required: false, items: ["Certificate of employment, business documents, or school records"] },
    ],
    faqs: defaultFaqs({ title: "UK Standard Visitor Visa" }, "A Standard Visitor Visa is usually valid for up to 6 months per visit."),
    relatedServices: relatedTravelCard(
      { country: "United Kingdom", featuredImage: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80" },
      "From London to Edinburgh, Manchester to Oxford — let us help plan your trip."
    ),
    inquiryForm: { fields: baseInquiryFields() },
    seo: {
      title: "UK Standard Visitor Visa Assistance | Airfair Travel and Tours",
      description: "Airfair helps you prepare the requirements and application process for your UK Standard Visitor Visa.",
    },
  },

  canada: {
    slug: "canada",
    country: "Canada",
    countryCode: "CA",
    flag: "ca",
    region: "North America",
    featured: true,
    visaType: "Visitor Visa (TRV)",
    title: "Canada Visitor Visa",
    hubTitle: "Canadian Visa",
    hubDescription: "Experience the best of Canada.",
    hubCta: "View Requirements",
    subtitle: "Experience the best of Canada.",
    description: "Airfair helps you prepare your Temporary Resident Visa (TRV) application for Canada, including documentation, biometrics, and travel history.",
    featuredImage: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=1600&q=80",
    aboutParagraphs: [
      "The Canada Visitor Visa (Temporary Resident Visa) allows eligible travelers to visit Canada for tourism, visiting family, or short-term business. Airfair helps you put together a complete, well-organized application.",
    ],
    highlights: defaultHighlights(),
    requirements: [
      { title: "Valid Passport", icon: "id-card", required: true, items: ["Valid for the duration of your intended stay"] },
      { title: "Completed Application Form", icon: "file-text", required: true, items: ["Online or paper visitor visa application"] },
      { title: "Proof of Funds", icon: "file-text", required: true, items: ["Bank statements showing sufficient funds for your trip"] },
      { title: "Letter of Explanation", icon: "clipboard-check", required: false, items: ["A letter describing the purpose and details of your visit"] },
      { title: "Biometrics", icon: "id-card", required: true, items: ["Fingerprints and photo at a Visa Application Centre"] },
      { title: "Travel History / Itinerary", icon: "plane", required: false, items: ["Previous travel history and/or a tentative itinerary"] },
    ],
    faqs: defaultFaqs({ title: "Canada Visitor Visa" }, "A visitor visa is usually valid for up to 6 months per visit, for up to 10 years of multiple entries if approved."),
    relatedServices: relatedTravelCard(
      { country: "Canada", featuredImage: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=800&q=80" },
      "From Toronto to Vancouver, Banff to Niagara Falls — let us help plan your trip."
    ),
    inquiryForm: { fields: baseInquiryFields() },
    seo: {
      title: "Canada Visitor Visa Assistance | Airfair Travel and Tours",
      description: "Airfair helps you prepare the requirements and application process for your Canada Visitor Visa (TRV).",
    },
  },

  schengen: {
    slug: "schengen",
    country: "Schengen Area",
    countryCode: "EU",
    flag: "eu",
    region: "Europe",
    featured: true,
    visaType: "Short-Stay Visa",
    title: "Schengen Visa",
    hubTitle: "Schengen Visa",
    hubDescription: "Explore 27 European countries with one visa.",
    hubCta: "View Requirements",
    subtitle: "Explore 27 European countries with one visa.",
    description: "A single Schengen Visa lets you travel across 27 European countries. Airfair helps you choose the right main destination, prepare your itinerary, and complete your application.",
    featuredImage: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=80",
    aboutParagraphs: [
      "The Schengen Visa allows travel across the Schengen Area for tourism, business, or visiting family. Airfair helps you apply through the correct embassy or consulate based on your main destination and itinerary.",
    ],
    highlights: defaultHighlights(),
    requirements: [
      { title: "Valid Passport", icon: "id-card", required: true, items: ["Valid for at least 3 months beyond your intended departure from the Schengen Area"] },
      { title: "Visa Application Form", icon: "file-text", required: true, items: ["Completed and signed Schengen visa application form"] },
      { title: "Travel Insurance", icon: "shield-check", required: true, items: ["Minimum coverage of €30,000 for medical emergencies, valid across the Schengen Area"] },
      { title: "Flight Itinerary", icon: "plane", required: true, items: ["Round-trip flight reservation"] },
      { title: "Hotel Bookings", icon: "home", required: true, items: ["Confirmed accommodation for your entire stay"] },
      { title: "Proof of Financial Means", icon: "file-text", required: true, items: ["Bank statements showing sufficient funds for your trip"] },
      { title: "Cover Letter", icon: "clipboard-check", required: false, items: ["A letter explaining the purpose and itinerary of your trip"] },
    ],
    faqs: defaultFaqs({ title: "Schengen Visa" }, "A Schengen short-stay visa allows up to 90 days within any 180-day period."),
    relatedServices: relatedTravelCard(
      { country: "Europe", featuredImage: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80" },
      "From Paris to Rome, Amsterdam to Barcelona — let us help plan your multi-country trip."
    ),
    inquiryForm: { fields: baseInquiryFields() },
    seo: {
      title: "Schengen Visa Assistance | Airfair Travel and Tours",
      description: "Airfair helps you prepare the requirements and application process for your Schengen short-stay visa.",
    },
  },

  australia: {
    slug: "australia",
    country: "Australia",
    countryCode: "AU",
    flag: "au",
    region: "Oceania",
    featured: false,
    visaType: "Visitor Visa",
    title: "Australia Visitor Visa",
    hubTitle: "Australia Visa",
    hubDescription: "Discover Australia's cities, coasts, and culture.",
    hubCta: "View Requirements",
    subtitle: "Discover Australia's cities, coasts, and culture.",
    description: "Airfair helps you understand the visitor visa or ETA options available for your trip to Australia, along with the documents you'll need to prepare.",
    featuredImage: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=1600&q=80",
    aboutParagraphs: [
      "Australia offers several visitor visa options depending on your nationality and purpose of travel. Airfair helps you identify the right option and prepare your application.",
    ],
    highlights: defaultHighlights(),
    requirements: [
      { title: "Valid Passport", icon: "id-card", required: true, items: ["Valid for the duration of your intended stay"] },
      { title: "Visa / ETA Application", icon: "file-text", required: true, items: ["Completed online visitor visa or Electronic Travel Authority application"] },
      { title: "Proof of Funds", icon: "file-text", required: true, items: ["Bank statements showing sufficient funds for your trip"] },
      { title: "Health & Character Requirements", icon: "shield-check", required: false, items: ["May be requested depending on your circumstances and length of stay"] },
    ],
    faqs: defaultFaqs({ title: "Australia Visitor Visa" }, "Most visitor visas allow a stay of up to 3 months per visit."),
    relatedServices: relatedTravelCard(
      { country: "Australia", featuredImage: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=800&q=80" },
      "From Sydney to Melbourne, the Great Barrier Reef to the Outback — let us help plan your trip."
    ),
    inquiryForm: { fields: baseInquiryFields() },
    seo: {
      title: "Australia Visitor Visa Assistance | Airfair Travel and Tours",
      description: "Airfair helps you understand the requirements and application process for your Australia visitor visa.",
    },
  },

  "south-korea": {
    slug: "south-korea",
    country: "South Korea",
    countryCode: "KR",
    flag: "kr",
    region: "Asia",
    featured: false,
    visaType: "Tourist Visa",
    title: "South Korea Tourist Visa",
    hubTitle: "South Korea Visa",
    hubDescription: "Experience the culture and cities of South Korea.",
    hubCta: "View Requirements",
    subtitle: "Experience the culture and cities of South Korea.",
    description: "Airfair helps you prepare the requirements and documentation for your South Korea tourist visa application.",
    featuredImage: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=1600&q=80",
    aboutParagraphs: [
      "The South Korea Tourist Visa allows travelers to visit for tourism, business, or visiting family. Airfair helps you prepare a complete and organized application.",
    ],
    highlights: defaultHighlights(),
    requirements: [
      { title: "Valid Passport", icon: "id-card", required: true, items: ["Valid for at least 6 months with blank visa pages"] },
      { title: "Visa Application Form", icon: "file-text", required: true, items: ["Duly accomplished and signed application form"] },
      { title: "Recent Photo", icon: "file-check", required: true, items: ["Passport-size photo taken within the last 6 months"] },
      { title: "Financial Documents", icon: "file-text", required: true, items: ["Bank certificate or statements showing sufficient funds"] },
      { title: "Employment Certificate", icon: "briefcase", required: false, items: ["Certificate of employment or business registration, if self-employed"] },
    ],
    faqs: defaultFaqs({ title: "South Korea Tourist Visa" }, "Most tourist visas allow a stay of up to 90 days."),
    relatedServices: relatedTravelCard(
      { country: "South Korea", featuredImage: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=800&q=80" },
      "From Seoul to Busan, Jeju Island to Incheon — let us help plan your trip."
    ),
    inquiryForm: { fields: baseInquiryFields() },
    seo: {
      title: "South Korea Tourist Visa Assistance | Airfair Travel and Tours",
      description: "Airfair helps you prepare the requirements and application process for your South Korea tourist visa.",
    },
  },

  singapore: {
    slug: "singapore",
    country: "Singapore",
    countryCode: "SG",
    flag: "sg",
    region: "Asia",
    featured: false,
    visaType: "Visit Pass",
    title: "Singapore Visit Pass",
    hubTitle: "Singapore Visa",
    hubDescription: "Visit Singapore for tourism or business.",
    hubCta: "View Requirements",
    subtitle: "Visit Singapore for tourism or business.",
    description: "Airfair helps you understand whether you need a visa for Singapore and assists in preparing your application if required.",
    featuredImage: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=1600&q=80",
    aboutParagraphs: [
      "Depending on your nationality, you may need a visa to visit Singapore for tourism or business. Airfair helps you check your requirements and prepare a complete application.",
    ],
    highlights: defaultHighlights(),
    requirements: [
      { title: "Valid Passport", icon: "id-card", required: true, items: ["Valid for at least 6 months beyond your intended stay"] },
      { title: "Visa Application Form", icon: "file-text", required: false, items: ["Required only for nationalities that need a visa to enter Singapore"] },
      { title: "Recent Photo", icon: "file-check", required: true, items: ["Passport-size photo taken within the last 6 months"] },
      { title: "Proof of Accommodation & Return Ticket", icon: "home", required: true, items: ["Hotel booking and confirmed round-trip flight"] },
    ],
    faqs: defaultFaqs({ title: "Singapore Visit Pass" }, "Most visit passes allow a stay of up to 30 days."),
    relatedServices: relatedTravelCard(
      { country: "Singapore", featuredImage: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=800&q=80" },
      "Marina Bay, Sentosa, and beyond — let us help plan your trip."
    ),
    inquiryForm: { fields: baseInquiryFields() },
    seo: {
      title: "Singapore Visit Pass Assistance | Airfair Travel and Tours",
      description: "Airfair helps you check your visa requirements and prepare your application to visit Singapore.",
    },
  },
};

const visaGalleryPhotos = {
  japan: ["photo-1540959733332-eab4deabeeaf", "photo-1695500950831-1dcd862e714f"],
  us: ["photo-1485738422979-f5c462d49f74", "photo-1496588152823-86ff7695e68f"],
  uk: ["photo-1513635269975-59663e0ac1ad", "photo-1659277329513-33509e0795fa"],
  canada: ["photo-1517935706615-2717063c2225", "photo-1559344404-d3d24a7480e4"],
  schengen: ["photo-1499856871958-5b9627545d1a", "photo-1559067379-8cd2f682479b"],
  australia: ["photo-1534407413251-b456a34fb3b3", "photo-1584190690728-2f40bd5664a8"],
  "south-korea": ["photo-1517154421773-0529f29ea451", "photo-1581610533395-f3dc786a6979"],
  singapore: ["photo-1525625293386-3f8f99389edd", "photo-1485257334450-84ec1ba6393d"],
};

for (const country of Object.values(visaCountries)) {
  country.gallery = visaGalleryPhotos[country.slug].map(photo => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1600&q=80`);
  country.featuredImage = country.gallery[0];
}

export const visaCountryList = Object.values(visaCountries);

export function getVisaCountry(slug) {
  return visaCountries[slug] || null;
}

// Maps a full country config down to the lightweight card shape used by
// VisaDestinationCard (the homepage teaser and the destination hub page).
export function toDestinationCard(country) {
  return {
    name: country.hubTitle || `${country.country} Visa`,
    slug: country.slug,
    region: country.region,
    description: country.hubDescription,
    flagCode: country.flag,
    image: country.featuredImage,
    cta: country.hubCta || "View Requirements",
    featured: !!country.featured,
  };
}
