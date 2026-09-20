import { VISA_TYPES } from "./formOptions.js";

// ---------------------------------------------------------------------------
// Centralized configuration for every Philippine Immigration Services page.
//
// The page template (ImmigrationServicePage + its section components) never
// changes per service. To add a new service, add ONE entry to this object —
// content, images, eligibility, assistance, and the form schema. Nothing else
// needs to be touched.
// ---------------------------------------------------------------------------

const EYEBROW = "PHILIPPINE IMMIGRATION SERVICES";

const STANDARD_ASSISTANCE = [
  {
    icon: "briefcase",
    title: "Requirements Guidance",
    description: "Clear checklist and explanation of required documents.",
  },
  {
    icon: "file-text",
    title: "Document Preparation",
    description: "Assistance in preparing and reviewing your documents.",
  },
  {
    icon: "users",
    title: "Application Assistance",
    description: "Support throughout the application process.",
  },
  {
    icon: "clock",
    title: "Process Coordination",
    description: "Help with follow-ups and renewals to keep your status active.",
  },
];

export const immigrationServices = {
  "13a-immigrant-visa": {
    slug: "13a-immigrant-visa",
    title: "13A Immigrant Visa by Marriage",
    eyebrow: EYEBROW,
    shortDescription:
      "Assistance for foreign nationals married to Filipino citizens who want to apply for residency in the Philippines.",
    heroDescription:
      "Let Airfair help you navigate the requirements and process for your 13A visa application with greater clarity and convenience.",
    heroImage: "https://images.unsplash.com/photo-1563463149242-bd378d9ab05c?auto=format&fit=crop&w=1200&q=80",
    aboutTitle: "What is the 13A Immigrant Visa?",
    aboutParagraphs: [
      "The 13A Immigrant Visa allows foreign nationals who are legally married to Filipino citizens to live in the Philippines as permanent residents.",
      "This visa grants multiple-entry privileges and is valid indefinitely, provided the marriage remains valid and the required documents are updated.",
    ],
    aboutImage: "https://images.unsplash.com/photo-1544396821-4dd40b938ad3?auto=format&fit=crop&w=1200&q=80",
    eligibility: [
      { icon: "heart", text: "Are legally married to a Filipino citizen" },
      { icon: "home", text: "Plan to live in the Philippines long-term" },
      { icon: "users", text: "Want to build a future with their Filipino spouse in the Philippines" },
      { icon: "file-text", text: "Need guidance with the 13A visa application and requirements" },
    ],
    assistanceItems: STANDARD_ASSISTANCE,
    form: {
      title: "Start Your Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      sections: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true, placeholder: "Juan Dela Cruz" },
            { id: "email", name: "email", label: "Email Address", type: "email", required: true, placeholder: "youremail@example.com" },
            { id: "phone", name: "phone", label: "Phone / WhatsApp Number", type: "tel", required: true, placeholder: "+63 912 345 6789" },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
            { id: "currentCountry", name: "currentCountry", label: "Current Country of Residence", type: "country", required: true },
            { id: "dateOfBirth", name: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
          ],
        },
        {
          id: "marriage-information",
          title: "Marriage Information",
          fields: [
            { id: "legallyMarried", name: "legallyMarried", label: "Are you legally married to a Filipino citizen?", type: "yesno", required: true },
            { id: "spouseFullName", name: "spouseFullName", label: "Spouse's Full Name", type: "text", required: true },
            { id: "spouseCitizenship", name: "spouseCitizenship", label: "Spouse's Citizenship", type: "country", required: true },
            { id: "dateOfMarriage", name: "dateOfMarriage", label: "Date of Marriage", type: "date", required: true },
            { id: "placeOfMarriage", name: "placeOfMarriage", label: "Place of Marriage", type: "text", required: true },
            { id: "marriageRegisteredPH", name: "marriageRegisteredPH", label: "Is your marriage registered in the Philippines?", type: "radio", options: ["Yes", "No", "Not Sure"], required: true },
          ],
        },
        {
          id: "immigration-status",
          title: "Immigration Status",
          fields: [
            { id: "currentlyInPH", name: "currentlyInPH", label: "Are you currently in the Philippines?", type: "yesno", required: true },
            { id: "currentVisaType", name: "currentVisaType", label: "Current Visa Type", type: "select", options: VISA_TYPES, required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "visaExpiration", name: "visaExpiration", label: "Visa Expiration Date", type: "date", required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "currentCountryAbroad", name: "currentCountryAbroad", label: "Country You're Currently In", type: "country", required: true, showWhen: { field: "currentlyInPH", equals: "No" } },
            { id: "expectedArrivalDate", name: "expectedArrivalDate", label: "Expected Arrival Date in the Philippines", type: "date", required: false, showWhen: { field: "currentlyInPH", equals: "No" } },
            { id: "previouslyApplied13A", name: "previouslyApplied13A", label: "Have you previously applied for a 13A Visa?", type: "yesno", required: true },
          ],
        },
        {
          id: "additional",
          title: "Additional Information",
          fields: [
            { id: "hasACR", name: "hasACR", label: "Do you currently have an ACR I-Card?", type: "yesno", required: true },
            { id: "pendingCase", name: "pendingCase", label: "Do you have any pending immigration case?", type: "yesno", required: true },
            { id: "message", name: "message", label: "Additional Details / Message", type: "textarea", required: false, placeholder: "Tell us more about your situation..." },
          ],
        },
      ],
    },
    seo: {
      title: "13A Immigrant Visa by Marriage Assistance | Airfair",
      description: "Airfair helps foreign spouses of Filipino citizens navigate the 13A Immigrant Visa requirements and application process.",
    },
  },

  "9g-working-visa": {
    slug: "9g-working-visa",
    title: "Pre-Arranged Working Visa (9G)",
    eyebrow: EYEBROW,
    shortDescription:
      "Immigration assistance for foreign nationals with a job offer or existing employment in the Philippines.",
    heroDescription:
      "Airfair helps you prepare the employer documentation, permits, and immigration filings needed to work legally in the Philippines.",
    heroImage: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=1200&q=80",
    aboutTitle: "What is the 9G Pre-Arranged Employee Visa?",
    aboutParagraphs: [
      "The 9G visa allows foreign nationals with a confirmed job offer from a Philippine-registered company to legally live and work in the country for the duration of their employment.",
      "The application generally requires coordination with your employer, an Alien Employment Permit (AEP), and supporting company documentation.",
    ],
    aboutImage: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80",
    eligibility: [
      { icon: "briefcase", text: "Have a confirmed job offer from a Philippine employer" },
      { icon: "building", text: "Will be employed by a Philippine-registered company" },
      { icon: "file-check", text: "Need help securing an Alien Employment Permit (AEP)" },
      { icon: "clock", text: "Want to keep their work visa status compliant and active" },
    ],
    assistanceItems: STANDARD_ASSISTANCE,
    form: {
      title: "Start Your Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      sections: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true },
            { id: "email", name: "email", label: "Email", type: "email", required: true },
            { id: "phone", name: "phone", label: "Phone", type: "tel", required: true },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
            { id: "currentCountry", name: "currentCountry", label: "Current Country", type: "country", required: true },
          ],
        },
        {
          id: "employment-information",
          title: "Employment Information",
          fields: [
            { id: "hasEmployer", name: "hasEmployer", label: "Do you already have a Philippine employer?", type: "yesno", required: true },
            { id: "companyName", name: "companyName", label: "Company Name", type: "text", required: true, showWhen: { field: "hasEmployer", equals: "Yes" } },
            { id: "jobPosition", name: "jobPosition", label: "Job Position", type: "text", required: true, showWhen: { field: "hasEmployer", equals: "Yes" } },
            { id: "companyAddress", name: "companyAddress", label: "Company Address", type: "text", required: true, width: "full", showWhen: { field: "hasEmployer", equals: "Yes" } },
            { id: "employerContact", name: "employerContact", label: "Employer Contact Person", type: "text", required: false, showWhen: { field: "hasEmployer", equals: "Yes" } },
            { id: "startDate", name: "startDate", label: "Expected Employment Start Date", type: "date", required: true },
          ],
        },
        {
          id: "immigration-status",
          title: "Immigration Status",
          fields: [
            { id: "currentlyInPH", name: "currentlyInPH", label: "Are you currently in the Philippines?", type: "yesno", required: true },
            { id: "currentVisaType", name: "currentVisaType", label: "Current Visa Type", type: "select", options: VISA_TYPES, required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "visaExpiration", name: "visaExpiration", label: "Visa Expiration Date", type: "date", required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "hasACR", name: "hasACR", label: "Do you already have an ACR I-Card?", type: "yesno", required: true },
          ],
        },
        {
          id: "employment-permit",
          title: "Employment Permit",
          fields: [
            { id: "aep", name: "aep", label: "Do you have an Alien Employment Permit (AEP)?", type: "select", options: ["Yes", "No", "In Process", "Not Sure"], required: true, width: "full" },
          ],
        },
        {
          id: "additional",
          title: "Additional Information",
          fields: [
            { id: "previous9G", name: "previous9G", label: "Have you previously held a 9G Visa?", type: "yesno", required: true },
            { id: "message", name: "message", label: "Additional Message", type: "textarea", required: false },
          ],
        },
      ],
    },
    seo: {
      title: "Pre-Arranged Working Visa (9G) Assistance | Airfair",
      description: "Airfair helps foreign professionals process the 9G working visa, AEP, and employer documentation for the Philippines.",
    },
  },

  "tourist-visa-extension": {
    slug: "tourist-visa-extension",
    title: "Tourist Visa Extension",
    eyebrow: EYEBROW,
    shortDescription: "Assistance for extending your authorized stay in the Philippines.",
    heroDescription:
      "Whether your visa is about to expire or has already lapsed, Airfair helps you understand your extension options and file the paperwork correctly.",
    heroImage: "https://images.unsplash.com/photo-1765707886539-6d57024ddc2f?auto=format&fit=crop&w=1200&q=80",
    aboutTitle: "What is a Tourist Visa Extension?",
    aboutParagraphs: [
      "A tourist visa extension allows foreign visitors to legally remain in the Philippines beyond their initial authorized stay.",
      "Extensions are typically processed with the Bureau of Immigration and vary depending on your nationality, current visa type, and length of stay requested.",
    ],
    aboutImage: "https://images.unsplash.com/photo-1566800890932-e89159daf3dc?auto=format&fit=crop&w=1200&q=80",
    eligibility: [
      { icon: "plane", text: "Are currently in the Philippines on a tourist visa" },
      { icon: "clock", text: "Want to extend their authorized stay" },
      { icon: "alert-triangle", text: "Have an expired or soon-to-expire visa" },
      { icon: "file-text", text: "Need guidance on extension requirements and fees" },
    ],
    assistanceItems: STANDARD_ASSISTANCE,
    form: {
      title: "Start Your Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      sections: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true },
            { id: "email", name: "email", label: "Email", type: "email", required: true },
            { id: "phone", name: "phone", label: "Phone", type: "tel", required: true },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
          ],
        },
        {
          id: "travel-information",
          title: "Travel Information",
          fields: [
            { id: "currentlyInPH", name: "currentlyInPH", label: "Are you currently in the Philippines?", type: "yesno", required: true },
            { id: "dateOfArrival", name: "dateOfArrival", label: "Date of Arrival", type: "date", required: true },
            { id: "currentVisaType", name: "currentVisaType", label: "Current Visa Type", type: "select", options: VISA_TYPES, required: true },
            { id: "currentVisaExpiration", name: "currentVisaExpiration", label: "Current Visa Expiration Date", type: "date", required: true },
            { id: "passportExpiration", name: "passportExpiration", label: "Passport Expiration Date", type: "date", required: true },
          ],
        },
        {
          id: "extension-information",
          title: "Extension Information",
          fields: [
            { id: "extensionLength", name: "extensionLength", label: "How long would you like to extend your stay?", type: "select", options: ["1 month", "2 months", "3 months", "6 months", "1 year", "Not sure yet"], required: true },
            { id: "extendedBefore", name: "extendedBefore", label: "Have you extended your tourist visa before?", type: "yesno", required: true },
            { id: "previousExtensionsCount", name: "previousExtensionsCount", label: "Number of previous extensions", type: "number", required: false, showWhen: { field: "extendedBefore", equals: "Yes" } },
            { id: "hasACR", name: "hasACR", label: "Do you currently have an ACR I-Card?", type: "yesno", required: true },
          ],
        },
        {
          id: "visa-status",
          title: "Visa Status",
          fields: [
            { id: "visaExpired", name: "visaExpired", label: "Has your visa already expired?", type: "radio", options: ["No", "Yes, less than 30 days", "Yes, more than 30 days"], required: true },
            { id: "message", name: "message", label: "Additional Message", type: "textarea", required: false },
          ],
        },
      ],
    },
    seo: {
      title: "Tourist Visa Extension Assistance | Airfair",
      description: "Airfair helps travelers extend their authorized stay in the Philippines with clear, compliant Bureau of Immigration filings.",
    },
  },

  "acr-i-card": {
    slug: "acr-i-card",
    title: "ACR I-Card",
    eyebrow: EYEBROW,
    shortDescription: "Assistance with Alien Certificate of Registration Identity Card requirements.",
    heroDescription:
      "From new applications to renewals and replacements, Airfair helps you prepare the requirements for your ACR I-Card.",
    heroImage: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1200&q=80",
    aboutTitle: "What is the ACR I-Card?",
    aboutParagraphs: [
      "The Alien Certificate of Registration Identity Card (ACR I-Card) is the official identification issued to registered foreign nationals residing in the Philippines.",
      "It must be renewed periodically and carried at all times, and is often required alongside your visa when transacting with government agencies.",
    ],
    aboutImage: "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?auto=format&fit=crop&w=1200&q=80",
    eligibility: [
      { icon: "id-card", text: "Are a registered foreign national in the Philippines" },
      { icon: "file-check", text: "Need a new, renewed, or replacement ACR I-Card" },
      { icon: "alert-triangle", text: "Have a lost, damaged, or expiring card" },
      { icon: "clipboard-check", text: "Need help updating their registration details" },
    ],
    assistanceItems: STANDARD_ASSISTANCE,
    form: {
      title: "Start Your Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      sections: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true },
            { id: "email", name: "email", label: "Email", type: "email", required: true },
            { id: "phone", name: "phone", label: "Phone", type: "tel", required: true },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
            { id: "dateOfBirth", name: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
            { id: "passportNumber", name: "passportNumber", label: "Passport Number", type: "text", required: true },
            { id: "passportExpiration", name: "passportExpiration", label: "Passport Expiration Date", type: "date", required: true },
          ],
        },
        {
          id: "visa-status",
          title: "Visa & Immigration Status",
          fields: [
            { id: "currentVisaType", name: "currentVisaType", label: "Current Visa Type", type: "select", options: VISA_TYPES, required: true },
            { id: "visaExpiration", name: "visaExpiration", label: "Visa Expiration Date", type: "date", required: true },
            { id: "currentlyInPH", name: "currentlyInPH", label: "Are you currently in the Philippines?", type: "yesno", required: true },
            { id: "hasACR", name: "hasACR", label: "Do you already have an ACR I-Card?", type: "yesno", required: true },
          ],
        },
        {
          id: "request-details",
          title: "Request Details",
          fields: [
            { id: "requestType", name: "requestType", label: "What do you need help with?", type: "select", width: "full", required: true, options: ["New Application", "Renewal", "Replacement", "Lost Card", "Damaged Card", "Update Information", "Other"] },
            { id: "currentACRExpiration", name: "currentACRExpiration", label: "Current ACR I-Card Expiration Date", type: "date", required: false, showWhen: { field: "hasACR", equals: "Yes" } },
            { id: "message", name: "message", label: "Additional Message", type: "textarea", required: false },
          ],
        },
      ],
    },
    seo: {
      title: "ACR I-Card Assistance | Airfair",
      description: "Airfair helps foreign nationals with new ACR I-Card applications, renewals, replacements, and updates in the Philippines.",
    },
  },

  "special-non-immigrant-visa": {
    slug: "special-non-immigrant-visa",
    title: "Special Non-Immigrant Visa",
    eyebrow: EYEBROW,
    shortDescription: "Support for applicable special non-immigrant visa applications.",
    heroDescription:
      "Airfair helps investors, missionaries, and other foreign nationals identify and apply for the special non-immigrant visa category that fits their situation.",
    heroImage: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80",
    aboutTitle: "What is a Special Non-Immigrant Visa?",
    aboutParagraphs: [
      "Special Non-Immigrant Visas cover a range of categories under Philippine immigration law for foreign nationals whose purpose of stay doesn't fall under standard tourist or work visas — such as treaty traders/investors, missionaries, or those covered by international agreements.",
      "The right category and requirements depend heavily on your specific purpose of stay, so Airfair helps you identify the correct classification before filing.",
    ],
    aboutImage: "https://images.unsplash.com/photo-1696283201322-04ef0aef3c54?auto=format&fit=crop&w=1200&q=80",
    eligibility: [
      { icon: "scale", text: "Fall under a treaty trader, investor, or international agreement category" },
      { icon: "globe", text: "Are a missionary or religious worker in the Philippines" },
      { icon: "file-text", text: "Are unsure which special visa category applies to them" },
      { icon: "clipboard-check", text: "Need help preparing sponsoring organization documents" },
    ],
    assistanceItems: STANDARD_ASSISTANCE,
    form: {
      title: "Start Your Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      sections: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true },
            { id: "email", name: "email", label: "Email", type: "email", required: true },
            { id: "phone", name: "phone", label: "Phone", type: "tel", required: true },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
            { id: "currentCountry", name: "currentCountry", label: "Current Country of Residence", type: "country", required: true },
          ],
        },
        {
          id: "visa-purpose",
          title: "Visa Purpose Information",
          fields: [
            { id: "visaCategory", name: "visaCategory", label: "Which special non-immigrant category applies to you?", type: "select", width: "full", required: true, options: ["Treaty Trader / Investor (9(d))", "Missionary / Religious Worker", "International Agreement (E.O. 47(a)(2))", "Government Official / Diplomat Dependent", "Other / Not Sure"] },
            { id: "sponsoringOrganization", name: "sponsoringOrganization", label: "Sponsoring Organization / Company Name", type: "text", required: false },
            { id: "purposeDescription", name: "purposeDescription", label: "Briefly describe the purpose of your stay", type: "textarea", required: true },
          ],
        },
        {
          id: "immigration-status",
          title: "Immigration Status",
          fields: [
            { id: "currentlyInPH", name: "currentlyInPH", label: "Are you currently in the Philippines?", type: "yesno", required: true },
            { id: "currentVisaType", name: "currentVisaType", label: "Current Visa Type", type: "select", options: VISA_TYPES, required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "visaExpiration", name: "visaExpiration", label: "Visa Expiration Date", type: "date", required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "hasACR", name: "hasACR", label: "Do you have an ACR I-Card?", type: "yesno", required: true },
          ],
        },
        {
          id: "additional",
          title: "Additional Information",
          fields: [
            { id: "previouslyHeldSpecialVisa", name: "previouslyHeldSpecialVisa", label: "Have you previously held a special non-immigrant visa?", type: "yesno", required: true },
            { id: "message", name: "message", label: "Additional Message", type: "textarea", required: false },
          ],
        },
      ],
    },
    seo: {
      title: "Special Non-Immigrant Visa Assistance | Airfair",
      description: "Airfair helps foreign nationals identify and apply for the correct special non-immigrant visa category in the Philippines.",
    },
  },

  naturalization: {
    slug: "naturalization",
    title: "Naturalization",
    eyebrow: EYEBROW,
    shortDescription: "Guidance for eligible foreign nationals seeking Philippine citizenship.",
    heroDescription:
      "Airfair helps long-term residents understand the naturalization process and prepare the requirements to become a Filipino citizen.",
    heroImage: "https://images.unsplash.com/photo-1710917554876-9e2ada25f7b4?auto=format&fit=crop&w=1200&q=80",
    aboutTitle: "What is Naturalization?",
    aboutParagraphs: [
      "Naturalization is the legal process through which a foreign national who meets residency, character, and other statutory requirements may become a citizen of the Philippines.",
      "Eligibility generally depends on factors such as length of residency, ties to the Philippines, and ability to speak a Philippine language, among other requirements.",
    ],
    aboutImage: "https://images.unsplash.com/photo-1546068996-8da61faeceaa?auto=format&fit=crop&w=1200&q=80",
    eligibility: [
      { icon: "landmark", text: "Have lived in the Philippines long-term" },
      { icon: "heart", text: "Are married to a Filipino citizen or have Filipino children" },
      { icon: "graduation-cap", text: "Can speak or understand a Philippine language" },
      { icon: "file-text", text: "Want guidance on citizenship eligibility and requirements" },
    ],
    assistanceItems: STANDARD_ASSISTANCE,
    form: {
      title: "Start Your Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      sections: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
            { id: "dateOfBirth", name: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
            { id: "email", name: "email", label: "Email", type: "email", required: true },
            { id: "phone", name: "phone", label: "Contact Number", type: "tel", required: true },
          ],
        },
        {
          id: "residency-information",
          title: "Residency Information",
          fields: [
            { id: "residencyLength", name: "residencyLength", label: "How long have you lived in the Philippines?", type: "select", options: ["Less than 5 years", "5–10 years", "10–20 years", "More than 20 years"], required: true },
            { id: "residencyStatus", name: "residencyStatus", label: "Current Visa / Residency Status", type: "text", required: true },
            { id: "permanentResident", name: "permanentResident", label: "Are you currently a permanent resident?", type: "yesno", required: true },
            { id: "hasACR", name: "hasACR", label: "Do you have an ACR I-Card?", type: "yesno", required: true },
          ],
        },
        {
          id: "background",
          title: "Background",
          fields: [
            { id: "marriedToFilipino", name: "marriedToFilipino", label: "Are you married to a Filipino citizen?", type: "yesno", required: true },
            { id: "hasFilipinoChildren", name: "hasFilipinoChildren", label: "Do you have Filipino children?", type: "yesno", required: true },
            { id: "employedOrBusiness", name: "employedOrBusiness", label: "Are you employed or operating a business in the Philippines?", type: "yesno", required: true },
            { id: "occupation", name: "occupation", label: "Occupation / Business", type: "text", required: false, showWhen: { field: "employedOrBusiness", equals: "Yes" } },
            { id: "speaksFilipino", name: "speaksFilipino", label: "Can you speak or understand Filipino or a Philippine language?", type: "yesno", required: true },
            { id: "previouslyApplied", name: "previouslyApplied", label: "Have you previously applied for Philippine citizenship?", type: "yesno", required: true },
          ],
        },
        {
          id: "additional",
          title: "Additional Details",
          fields: [
            { id: "message", name: "message", label: "Additional Details", type: "textarea", required: false },
          ],
        },
      ],
    },
    seo: {
      title: "Philippine Naturalization Assistance | Airfair",
      description: "Airfair guides eligible foreign nationals through the requirements and process for Philippine naturalization.",
    },
  },

  "deportation-assistance": {
    slug: "deportation-assistance",
    title: "Deportation Assistance",
    eyebrow: EYEBROW,
    shortDescription: "Support and guidance for immigration-related deportation matters.",
    heroDescription:
      "If you've received a deportation order, Notice to Leave, or are facing an active immigration case, Airfair helps you understand your options and next steps.",
    heroImage: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=1200&q=80",
    aboutTitle: "Facing a Deportation or Immigration Case?",
    aboutParagraphs: [
      "Deportation proceedings and Bureau of Immigration cases can move quickly and carry serious consequences. Airfair helps foreign nationals understand their case status and coordinate the right next steps.",
      "We work with clients to gather documentation, understand deadlines, and connect with appropriate legal support when needed.",
    ],
    aboutImage: "https://images.unsplash.com/photo-1581553673739-c4906b5d0de8?auto=format&fit=crop&w=1200&q=80",
    eligibility: [
      { icon: "alert-triangle", text: "Have received a deportation order or Notice to Leave" },
      { icon: "scale", text: "Have an active or pending immigration case" },
      { icon: "shield-check", text: "Need help understanding their current visa status" },
      { icon: "clock", text: "Are facing an urgent deadline and need guidance quickly" },
    ],
    assistanceItems: [
      { icon: "clipboard-check", title: "Case Assessment", description: "Clear review of your current immigration case and status." },
      { icon: "file-text", title: "Document Preparation", description: "Assistance gathering and organizing the documents your case needs." },
      { icon: "scale", title: "Legal Coordination", description: "Coordination with appropriate legal counsel where needed." },
      { icon: "clock", title: "Process Coordination", description: "Help tracking deadlines and following up on your case." },
    ],
    form: {
      title: "Start Your Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      sections: [
        {
          id: "contact",
          title: "Contact Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true },
            { id: "email", name: "email", label: "Email", type: "email", required: true },
            { id: "phone", name: "phone", label: "Phone / WhatsApp", type: "tel", required: true },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
          ],
        },
        {
          id: "case-information",
          title: "Case Information",
          fields: [
            { id: "currentlyInPH", name: "currentlyInPH", label: "Are you currently in the Philippines?", type: "yesno", required: true },
            { id: "currentVisaStatus", name: "currentVisaStatus", label: "Current Visa Status", type: "text", required: true },
            { id: "currentlyDetained", name: "currentlyDetained", label: "Are you currently detained?", type: "yesno", required: true },
            { id: "receivedDeportationOrder", name: "receivedDeportationOrder", label: "Have you received a deportation order or notice?", type: "yesno", required: true },
            { id: "receivedNTL", name: "receivedNTL", label: "Have you received a Notice to Leave?", type: "yesno", required: true },
            { id: "activeCase", name: "activeCase", label: "Do you have an active immigration case?", type: "yesno", required: true },
            { id: "caseReferenceNumber", name: "caseReferenceNumber", label: "Case / Reference Number", type: "text", required: false, showWhen: { field: "activeCase", equals: "Yes" } },
            { id: "noticeDate", name: "noticeDate", label: "Date you received the notice", type: "date", required: false },
            { id: "hasLegalRepresentation", name: "hasLegalRepresentation", label: "Do you have legal representation?", type: "yesno", required: true },
          ],
        },
        {
          id: "urgency-details",
          title: "Urgency & Details",
          fields: [
            { id: "urgency", name: "urgency", label: "How urgent is your situation?", type: "radio", options: ["Urgent", "Within 7 days", "General Consultation"], required: true },
            { id: "situationDescription", name: "situationDescription", label: "Briefly describe your situation", type: "textarea", required: true },
          ],
        },
      ],
    },
    seo: {
      title: "Deportation Assistance | Airfair",
      description: "Airfair helps foreign nationals facing deportation orders or immigration cases in the Philippines understand their next steps.",
    },
  },

  "visa-reconsideration": {
    slug: "visa-reconsideration",
    title: "Petition / Visa Reconsideration",
    eyebrow: EYEBROW,
    shortDescription: "Assistance involving immigration petitions or reconsideration matters.",
    heroDescription:
      "If a visa or immigration application was denied or questioned, Airfair helps you understand the decision and prepare a motion for reconsideration.",
    heroImage: "https://images.unsplash.com/photo-1715927134295-6b1016e28414?auto=format&fit=crop&w=1200&q=80",
    aboutTitle: "What is a Petition / Visa Reconsideration?",
    aboutParagraphs: [
      "A motion for reconsideration allows applicants to formally request a review of a denied or questioned immigration decision.",
      "Airfair helps you review the reason for denial, gather supporting documentation, and prepare a well-organized petition within the applicable deadline.",
    ],
    aboutImage: "https://images.unsplash.com/photo-1549813069-a5f8c1dce35f?auto=format&fit=crop&w=1200&q=80",
    eligibility: [
      { icon: "alert-triangle", text: "Had a visa or immigration application denied" },
      { icon: "file-search", text: "Received a decision they believe was incorrect" },
      { icon: "clock", text: "Have a deadline to file a motion for reconsideration" },
      { icon: "file-text", text: "Need help preparing a petition or supporting evidence" },
    ],
    assistanceItems: STANDARD_ASSISTANCE,
    form: {
      title: "Start Your Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      sections: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true },
            { id: "email", name: "email", label: "Email", type: "email", required: true },
            { id: "phone", name: "phone", label: "Contact Number", type: "tel", required: true },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
            { id: "currentVisaType", name: "currentVisaType", label: "Current Visa Type", type: "select", options: VISA_TYPES, required: true },
            { id: "currentLocation", name: "currentLocation", label: "Current Location", type: "text", required: true },
          ],
        },
        {
          id: "decision-information",
          title: "Decision Information",
          fields: [
            { id: "deniedApplication", name: "deniedApplication", label: "What application was denied or questioned?", type: "text", width: "full", required: true },
            { id: "denialDate", name: "denialDate", label: "Date of denial / decision", type: "date", required: true },
            { id: "hasDecisionCopy", name: "hasDecisionCopy", label: "Do you have a copy of the decision?", type: "yesno", required: true },
            { id: "denialReason", name: "denialReason", label: "Reason stated in the decision", type: "textarea", required: false },
            { id: "filedMotionBefore", name: "filedMotionBefore", label: "Have you filed a motion or reconsideration before?", type: "yesno", required: true },
            { id: "deadline", name: "deadline", label: "Deadline, if known", type: "date", required: false },
          ],
        },
        {
          id: "case-details",
          title: "Case Details",
          fields: [
            { id: "caseReferenceNumber", name: "caseReferenceNumber", label: "Case / Reference Number", type: "text", required: false },
            { id: "situationDescription", name: "situationDescription", label: "Brief description of the situation", type: "textarea", required: true },
            { id: "decisionDocument", name: "decisionDocument", label: "Immigration decision / notice (optional)", type: "file", required: false },
          ],
        },
      ],
    },
    seo: {
      title: "Petition & Visa Reconsideration Assistance | Airfair",
      description: "Airfair helps applicants prepare motions for reconsideration for denied or questioned Philippine visa and immigration decisions.",
    },
  },

  consultation: {
    slug: "consultation",
    title: "Immigration-Related Consultation",
    eyebrow: EYEBROW,
    shortDescription: "Guidance for other immigration concerns and requirements.",
    heroDescription:
      "Not sure which service applies to your situation? Tell us about your concern and Airfair's team will point you in the right direction.",
    heroImage: "https://images.unsplash.com/photo-1749468373693-a857cdb4579e?auto=format&fit=crop&w=1200&q=80",
    aboutTitle: "General Immigration Consultation",
    aboutParagraphs: [
      "Sometimes it isn't clear which visa or immigration process applies to your situation. Airfair offers a general consultation to help you understand your options before moving forward.",
      "Tell us a bit about your concern, and our team will recommend the right next step — whether that's a specific visa application, an extension, or another immigration service.",
    ],
    aboutImage: "https://images.unsplash.com/photo-1771533679889-fa1bf5df299a?auto=format&fit=crop&w=1200&q=80",
    eligibility: [
      { icon: "help-circle", text: "Are unsure which immigration service applies to them" },
      { icon: "globe", text: "Are exploring options for living, working, or retiring in the Philippines" },
      { icon: "message-circle", text: "Want general guidance before starting an application" },
      { icon: "users", text: "Need a starting point for their immigration journey" },
    ],
    assistanceItems: STANDARD_ASSISTANCE,
    form: {
      title: "Start Your Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      sections: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true },
            { id: "email", name: "email", label: "Email", type: "email", required: true },
            { id: "phone", name: "phone", label: "Phone", type: "tel", required: true },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
            { id: "currentCountry", name: "currentCountry", label: "Current Country", type: "country", required: true },
          ],
        },
        {
          id: "immigration-situation",
          title: "Immigration Situation",
          fields: [
            { id: "currentlyInPH", name: "currentlyInPH", label: "Are you currently in the Philippines?", type: "yesno", required: true },
            { id: "currentVisaType", name: "currentVisaType", label: "Current Visa Type", type: "select", options: VISA_TYPES, required: false, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "helpNeeded", name: "helpNeeded", label: "What do you need help with?", type: "select", width: "full", required: true, options: ["Visa Application", "Visa Extension", "Working Visa", "Marriage Visa", "ACR I-Card", "Permanent Residency", "Naturalization", "Immigration Case", "Deportation", "Visa Reconsideration", "Other"] },
            { id: "concernDescription", name: "concernDescription", label: "Briefly describe your concern", type: "textarea", required: true },
          ],
        },
        {
          id: "contact-preference",
          title: "Contact Preference",
          fields: [
            { id: "preferredContactMethod", name: "preferredContactMethod", label: "Preferred Contact Method", type: "radio", options: ["Phone", "WhatsApp", "Email"], required: true },
          ],
        },
      ],
    },
    seo: {
      title: "Immigration Consultation | Airfair",
      description: "Not sure which visa or immigration service you need? Get general guidance from Airfair's immigration team.",
    },
  },
  "special-resident-retirees-visa": {
    slug: "special-resident-retirees-visa",
    title: "Special Resident Retiree's Visa (SRRV)",
    titleHighlight: "(SRRV)",
    category: "Philippine Immigration Services",
    eyebrow: EYEBROW,
    shortDescription:
      "Retirement residency assistance for eligible foreign nationals planning to make the Philippines their long-term home.",
    heroDescription:
      "Airfair helps simplify the SRRV process by guiding you through the requirements, documentation, and application journey.",
    heroImage: "https://images.unsplash.com/photo-1710917554876-9e2ada25f7b4?auto=format&fit=crop&w=1200&q=80",
    heroPrimaryCta: "Start Your SRRV Assessment",
    aboutEyebrow: "ABOUT THIS VISA",
    aboutTitle: "What is the Special Resident Retiree's Visa?",
    aboutParagraphs: [
      "The Special Resident Retiree's Visa (SRRV) is a residency option designed for eligible foreign nationals who wish to retire in the Philippines and enjoy a long-term stay in the country.",
      "Airfair can assist you in understanding the application process, preparing the necessary documentation, and identifying the next steps based on your situation.",
    ],
    eligibilityStyle: "checklist",
    eligibilitySubtext: "The SRRV is ideal for foreign nationals who:",
    eligibility: [
      { text: "Are planning to retire in the Philippines" },
      { text: "Are looking for a long-term residency option" },
      { text: "Wish to bring their spouse or qualified dependents" },
      { text: "Need guidance on the application process and requirements" },
    ],
    assistanceSubtext: "We provide end-to-end assistance to make your SRRV application smooth and hassle-free.",
    assistanceItems: [
      { icon: "users", title: "Eligibility Guidance", description: "Help you understand which SRRV option may apply to your situation." },
      { icon: "file-text", title: "Document Preparation", description: "Guidance in organizing and preparing application documents." },
      { icon: "message-circle", title: "Application Assistance", description: "Support throughout the preparation and submission process." },
      { icon: "clock", title: "Process Coordination", description: "Assistance with follow-ups and next steps throughout your application." },
    ],
    whyChooseAirfair: {
      title: "Why Choose Airfair?",
      paragraph:
        "Choosing to retire in a new country is a big decision. At Airfair, we make the process easier by providing clear guidance, practical assistance, and personalized support. Our team is here to help you understand your options and move forward with confidence.",
    },
    hideHelpCta: true,
    form: {
      title: "Start Your SRRV Assessment",
      description: "Fill out the form below and our team will get back to you with the next steps.",
      submitLabel: "Submit SRRV Assessment",
      privacyNote: "Your information will be used only to assist you with your inquiry.",
      sections: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "fullName", name: "fullName", label: "Full Name", type: "text", required: true, placeholder: "Juan Dela Cruz" },
            { id: "email", name: "email", label: "Email Address", type: "email", required: true, placeholder: "youremail@example.com" },
            { id: "phone", name: "phone", label: "Phone / WhatsApp Number", type: "tel", required: true, placeholder: "+63 912 345 6789" },
            { id: "nationality", name: "nationality", label: "Nationality", type: "country", required: true },
            { id: "dateOfBirth", name: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
            { id: "currentCountry", name: "currentCountry", label: "Current Country of Residence", type: "country", required: true },
          ],
        },
        {
          id: "retirement-information",
          title: "Retirement Information",
          fields: [
            { id: "currentlyRetired", name: "currentlyRetired", label: "Are you currently retired?", type: "radio", options: ["Yes", "No", "Planning to retire"], required: true },
            { id: "occupationStatus", name: "occupationStatus", label: "What is your current occupation or retirement status?", type: "select", width: "full", required: true, options: ["Retired / Not working", "Employed", "Self-employed / Business owner", "Planning to retire soon", "Other"] },
            { id: "receivingPension", name: "receivingPension", label: "Are you currently receiving a pension?", type: "radio", options: ["Yes", "No", "Prefer not to say"], required: true },
            { id: "longTermIntent", name: "longTermIntent", label: "Are you planning to live in the Philippines long-term?", type: "radio", options: ["Yes", "No", "Still deciding"], required: true },
          ],
        },
        {
          id: "immigration-status",
          title: "Philippines / Immigration Status",
          fields: [
            { id: "currentlyInPH", name: "currentlyInPH", label: "Are you currently in the Philippines?", type: "yesno", required: true },
            { id: "currentVisaType", name: "currentVisaType", label: "Current Visa Type", type: "select", options: VISA_TYPES, required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "dateOfArrival", name: "dateOfArrival", label: "Date of Arrival", type: "date", required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "visaExpiration", name: "visaExpiration", label: "Visa Expiration Date", type: "date", required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "hasACR", name: "hasACR", label: "Do you have an ACR I-Card?", type: "yesno", required: true, showWhen: { field: "currentlyInPH", equals: "Yes" } },
            { id: "expectedArrivalDate", name: "expectedArrivalDate", label: "Expected Arrival Date", type: "date", required: false, showWhen: { field: "currentlyInPH", equals: "No" } },
            { id: "previouslyVisitedPH", name: "previouslyVisitedPH", label: "Have you previously visited the Philippines?", type: "yesno", required: false, showWhen: { field: "currentlyInPH", equals: "No" } },
          ],
        },
        {
          id: "family-dependents",
          title: "Family / Dependents",
          fields: [
            { id: "spouseIncluded", name: "spouseIncluded", label: "Will your spouse be included in your residency plans?", type: "radio", options: ["Yes", "No", "Not Sure"], required: true },
            { id: "bringingDependents", name: "bringingDependents", label: "Will you be bringing dependents?", type: "yesno", required: true },
            { id: "numberOfDependents", name: "numberOfDependents", label: "Number of Dependents", type: "number", required: false, showWhen: { field: "bringingDependents", equals: "Yes" } },
          ],
        },
        {
          id: "additional",
          title: "Additional Details",
          fields: [
            { id: "previouslyAppliedSRRV", name: "previouslyAppliedSRRV", label: "Have you previously applied for an SRRV?", type: "yesno", required: true },
            { id: "helpNeeded", name: "helpNeeded", label: "What do you need help with?", type: "select", width: "full", required: true, options: ["Understanding SRRV eligibility", "New SRRV application", "Documents and requirements", "Existing SRRV application", "General SRRV consultation", "Other"] },
            { id: "message", name: "message", label: "Additional Details / Message", type: "textarea", required: false, placeholder: "Tell us more about your retirement plans..." },
          ],
        },
      ],
    },
    seo: {
      title: "Special Resident Retiree's Visa (SRRV) Assistance | Airfair",
      description: "Airfair helps eligible foreign nationals understand and apply for the Special Resident Retiree's Visa (SRRV) in the Philippines.",
    },
  },
};

export const immigrationServiceList = Object.values(immigrationServices);

export function getImmigrationService(slug) {
  return immigrationServices[slug] || null;
}
