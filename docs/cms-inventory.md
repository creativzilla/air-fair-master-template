# CMS Inventory & Gap Analysis — Phase 1 (Audit only)

> Status: **audit only, no code changed.** Awaiting approval before Phase 2.
> Audited: working tree on `main` @ `863184e` + uncommitted edits in `src/pages/Website.jsx` / `src/index.css` (2026-09-26).

---

## 0. TL;DR

- The **website is ~95% hardcoded.** Almost all content lives in JS data files (`src/lib/*.js`) or inline JSX. Only four things are read from Supabase today: `site_settings` (contact info, socials, SEO title, chat widget), `testimonials`, one testimonials heading from `content_blocks`, and `services` (only for an orphaned `/package/:slug` route that nothing links to).
- The **dashboard has a real backend for the CRM side**: submissions → pipeline → contacts → employees → tasks, plus Catalog and Settings. The **content-management side is mostly disconnected**: *Edit Website* edits 4 seeded sections the website doesn't render (except one heading). *Media* is placeholder images. *Form builder* is local state only. *Calendar* is read-only.
- The **Travel & Visa Posters** uploader is the only CMS feature that fully works end-to-end.
- **Critical risk:** the dashboard login screen lets **anyone create an account**, and RLS gives *every* authenticated user full read/write on leads, contacts, employees and site content. See §6.
- **Critical gap:** submitted form answers (`raw_data`) are saved but **never shown in the dashboard**. Staff only see name, email and form type.

---

## 1. Codebase map

### 1.1 Tech & structure
- Vite + React 18 + react-router-dom 6, Tailwind (dashboard only), plain CSS for the website (`src/index.css`, ~page CSS files), lucide-react icons, `@supabase/supabase-js`.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`.env`, gitignored).
- Hosting: Vercel (`vercel.json` rewrites) + Netlify-style `public/_redirects`.
- **Legacy/unused files (not imported anywhere):** `air-fair-website.jsx` (602 lines), `client-dashboard.jsx` (3,262 lines) in repo root. `dist/` is committed.

### 1.2 Routes (`src/main.jsx`)

| Route | Page component | Content source |
|---|---|---|
| `/` | `pages/Website.jsx` → `Website` | Inline consts + `lib/travelDestinations.js`, `lib/visaDestinations.js`, `lib/news.js`; DB: `site_settings`, `testimonials`, `pages/sections/content_blocks` |
| `/news` | `pages/NewsPage.jsx` | `lib/news.js` |
| `/news/:slug` | `pages/NewsArticlePage.jsx` | `lib/news.js` + `lib/newsArticleContent.js` |
| `/package/:slug` | `Website.jsx` → `PackageDetailPage` | DB `services` (published). **Not linked from anywhere on the site.** |
| `/philippine-immigration-services` | `pages/PhilippineImmigrationServices.jsx` | Inline consts (duplicates homepage list) |
| `/philippine-immigration-services/:serviceSlug` | `pages/ImmigrationServicePage.jsx` | `lib/immigrationServices.js` (10 entries) |
| `/visa-assistance/international-tourist-visa` | `pages/InternationalVisaAssistancePage.jsx` | Inline + `lib/visaDestinations.js` |
| `/visa-assistance/:countrySlug` | `pages/VisaCountryPage.jsx` | `lib/visaCountries.js` (8 entries) + poster from Storage |
| `/travel-tours` | `pages/TravelToursPage.jsx` | `lib/travelDestinations.js` |
| `/travel-tours/:packageSlug` | `pages/TravelPackageDetailPage.jsx` | `lib/travelDestinations.js` (7 packages + 5 homepage offers) + poster from Storage |
| `/dashboard` | `pages/Dashboard.jsx` | Supabase (auth required) |

### 1.3 Shared website chrome (exported from `Website.jsx`, used on every page)
- `TopBars`: fake "browser bar" strip (shows `business_name — Website`, "Make a copy / Share"), promise bar, main nav, search panel. Search input does nothing.
- `Footer`: brand blurb, social icons (`site_settings`), 3 link columns, contact column (`site_settings`), newsletter form. The newsletter form does not save anything.
- `ChatWidget`: injects `site_settings.chat_widget_code` or shows a mail bubble.
- `SectionTitle`, `colors`, `fallbackSettings`.

### 1.4 Components
- `components/immigration/*`: `ServiceHero`, `ServiceAbout`, `EligibilityGrid`, `AssistanceGrid`, `WhyChooseSection`, `ServiceAssessmentForm`, `FormSection`, `DynamicFormField` (schema-driven field renderer: text/email/tel/date/number/textarea/select/country/radio/yesno/checkbox/file, `showWhen` conditions), `ServiceHelpCTA`, `icons.js` (icon-name → lucide map).
- `components/visa/*`: `VisaBreadcrumb`, `VisaIntro`, `VisaFeaturedImage`, `VisaAbout`, `VisaHighlights`, `VisaRequirements`/`RequirementItem`, `VisaFAQ` (also reused by travel), `VisaInquiryForm`, `VisaSupportCard`, `RelatedServicesCard`, `VisaDestinationCard`.
- `components/travel/*`: `TravelToursHeader`, `TravelPromoSlider`/`TravelPromoPoster`, `TravelSearchBar`, `PopularDestinations`/`DestinationCard`, `FeaturedPackages`/`TravelPackageCard`, `TravelCTA`, `PackageBreadcrumb`, `PackageIntro`, `PackageFeaturedImage`, `PackageAbout`, `PackageHighlightsGrid`, `PackageIncluded`, `PackageInquiryForm`, `PackageRelatedCard`, `PackageSidebarPoster`, `TravelPosterEditor` (dashboard widget).
- `components/NewsEvents.jsx`: homepage news strip.

---

## 2. Website content inventory

**How to read "Proposed CMS field":** this is the field each item would map to under the model proposed in §5.
- `settings.*` = existing `site_settings` columns.
- `home.<section>.*` = existing `pages/sections/content_blocks` engine (page `home`, section `template_type`).
- `immigration[slug].*`, `visa[slug].*`, `travel[slug].*` = per-entity records (see §5.2).
- `news[slug].*` = news records.
- ⚙ = already DB-driven today.

### 2.1 Global / chrome

| Item | Current value (abridged) | File | Proposed CMS field |
|---|---|---|---|
| Business name ⚙ | "Air Fair Travel & Immigration" (fallback) | `Website.jsx:25` / DB | `settings.business_name` |
| Contact email ⚙ | airfairtravelandours@gmail.com | `Website.jsx:27` / DB | `settings.contact_email` |
| Contact phone ⚙ | +63 906-331-7785 | `Website.jsx:28` / DB | `settings.contact_phone` |
| Address ⚙ | "Philippines" | `Website.jsx:29` / DB | `settings.address` |
| Facebook/Instagram/LinkedIn ⚙ | empty | DB | `settings.facebook_url` etc. |
| SEO title ⚙ (homepage only) | — | DB | `settings.seo_title` |
| SEO description | set in Settings but **never applied**; `index.html` has a static meta description | `index.html:7` | `settings.seo_description` → apply via head manager |
| Chat widget ⚙ | — | DB | `settings.chat_widget_code` |
| Currency symbol ⚙ | ₱ | DB | `settings.currency_symbol` |
| Logo | `/airfair_logo_colored.png` | `Website.jsx:169`, `NewsArticlePage.jsx` | `settings.logo_url` (column exists, unused) |
| Browser-bar strip | "{name} — Website", "Make a copy", "Share" | `Website.jsx:178` | **Remove** (looks like a template/mockup artifact), or `settings` toggle |
| Promise bar (4 items) | Free Cancellation within 24 hrs / Best Price Guarantee / Secure Booking / 24/7 Customer Support | `Website.jsx:179` | `global.promise_bar.items[]` |
| Main nav labels + anchors | Home, Our Services, Free Assessment, Visa & Immigration, About Us, Contact; "Book Now" | `Website.jsx:184-186` | `global.nav.items[] {label, href}` |
| Search placeholder | "Search visa and immigration services" (non-functional) | `Website.jsx:188` | `global.nav.search_placeholder`; flag as non-functional |
| Footer blurb | "Your trusted travel partner and visa consultant…" | `Website.jsx:451` | `global.footer.blurb` |
| Footer COMPANY links | About Us, Our Team, Careers, Blog, Contact Us (all point to `#about`/`#our-services`) | `Website.jsx:451` | `global.footer.columns[]` |
| Footer VISA SERVICES links | Tourist Visa, 9G, 13A, SRRV, ACR-I, Other (all `#our-services`) | `Website.jsx:451` | `global.footer.columns[]` |
| Newsletter heading/copy | "SUBSCRIBE TO OUR NEWSLETTER", "Get the latest updates and travel deals." | `Website.jsx:451` | `global.footer.newsletter_*` |
| Copyright | "© 2025 Air Fair Travel and Tours OPC…" | `Website.jsx:451` | `global.footer.copyright` |
| Privacy / Terms | Plain text, no links, no pages | `Website.jsx:451` | `global.footer.legal_links[]` (pages don't exist) |
| Page `<title>`s | Hardcoded per page (e.g. "Travel & Tours Packages \| …", "News & Current Events \| Air Fair") | each page | `pages.seo_title` per page |

### 2.2 Homepage `/` (render order, `Website.jsx:568`)

| Section | Content | File:line | Proposed CMS field |
|---|---|---|---|
| **Hero slider** | 4 slides × {tag, icon, headline, highlight, subheading, description, 3 features, CTA label, CTA href, 4 Unsplash images}. Also "PHILIPPINES 🇵🇭" flag label, trust strip label "Your Trusted Visa & Immigration Partner" + 4 items (Travel/Family/Opportunity/A Brighter Tomorrow). Timing 2s/image. | `Website.jsx:39-109, 196-262` | `home.hero.slides[] {tag, icon, headline, highlight, subheading, description, features[3], cta_label, cta_href, images[4]}`, `home.hero.flag_label`, `home.hero.trust_label`, `home.hero.trust_items[]`. **Seeded `hero` section in DB (heading/subheading/cta) is NOT rendered.** |
| **Accreditation bar** | "Officially Accredited By"; 3 logos (`/dole-logo-v2.png`, `/bi-logo-v2.png`, `/pra-logo-v2.png`) + labels + "Republic of the Philippines" | `Website.jsx:111-115, 264-273` | `home.accreditations.label`, `.items[] {logo, sub, label}` |
| **Service categories** (4 cards) | Titles, descriptions, icon, href, theme colour. Note typo "**Aitfair**" in visa card | `Website.jsx:117-122` | `home.categories.items[] {title, desc, icon, href, theme}` |
| **Immigration services** | Banner heading + paragraph; 9 cards {title, desc, icon, slug} | `Website.jsx:124-134, 291-307` | Heading/copy → `home.immigration.*`; cards → derived from `immigration[]` records (`title`, `card_description`, `icon`, `show_on_home`) |
| **SRRV banner** | Image `/srrv-retire-paradise-2.png`, H2, subhead, description, 5 benefits, 2 CTAs | `Website.jsx:309-339` | `home.srrv_banner.{image, heading, subheading, description, benefits[], cta_primary_*, cta_secondary_*}` |
| **International visa assistance** | Title, description, "View All Destinations →"; cards = `featured` visa countries (5) | `Website.jsx:341-351` | `home.visa.*`; cards from `visa[]` where `featured=true` |
| **Travel & Tours** | Title, description, "View All Travel Packages →"; 5 offer cards {name, place, flagCode, price string, image}; overlay icon `/travel-tours-icon.png` | `Website.jsx:353-374`, `lib/travelDestinations.js:412-418` | `home.travel.*`; cards from `travel[]` where `show_on_home=true` |
| **Trust bar** | 4 items. **Defined but no longer rendered** (removed in uncommitted edit) | `Website.jsx:138-143, 376-388` | Decide: delete or `home.trust_bar.items[]` |
| **Free assessment** | H2 "Not sure which visa / you need?", paragraph, 2 CTAs, 3 trust items, 3 numbered steps | `Website.jsx:390-411` | `home.assessment.{heading, heading_accent, body, cta_*, trust_items[], steps[] {title, text, icon}}` |
| **Testimonials** | Heading ⚙ (`content_blocks` testimonials.heading), sub-copy (hardcoded), cards ⚙ from `testimonials` (first 3) with 3 hardcoded fallbacks; fake pagination dots; stats "+2,500 Happy Clients", "4.9/5 Average Rating", avatar initials "MC JR AC", tagline "JOURNEYS TO A BRIGHTER TOMORROW" | `Website.jsx:414-438` | `home.testimonials.{heading⚙, subheading, stats[], tagline}`; cards → `testimonials` table ⚙ |
| **News & events** | Heading, sub-copy, "View all news", note; 4 story cards | `components/NewsEvents.jsx` | `home.news.*`; cards from `news[]` where `featured` |
| **Contact** | H2 "Ready to make your travel dreams a reality?", paragraph; phone/email/address ⚙; form placeholders; success message | `Website.jsx:440-446` | `home.contact.{heading, body, success_title, success_body}` |

### 2.3 Philippine Immigration Services hub (`PhilippineImmigrationServices.jsx`)

| Item | Proposed CMS field |
|---|---|
| Hero: H1, sub, description, 2 CTAs, Unsplash hero image | `page[pis-hub].hero.*` |
| About: image, H2, 2 paragraphs | `page[pis-hub].about.*` |
| Services grid: title/description + **9 cards duplicated from homepage** (third copy of the list; also in `lib/immigrationServices.js`) | Derived from `immigration[]` records |
| Why choose: 4 features {title, description, icon} | `page[pis-hub].why.items[]` |
| Final CTA: H2, paragraph, 2 buttons | `page[pis-hub].cta.*` |

### 2.4 Immigration service detail (`lib/immigrationServices.js`, 10 records)

Slugs: `13a-immigrant-visa`, `9g-working-visa`, `tourist-visa-extension`, `acr-i-card`, `special-non-immigrant-visa`, `naturalization`, `deportation-assistance`, `visa-reconsideration`, `consultation`, `special-resident-retirees-visa` (SRRV has extra fields).

Per-record fields → proposed `immigration[slug].*`:
`slug, title, titleHighlight*, category*, eyebrow, shortDescription, heroDescription, heroImage, heroPrimaryCta*, heroSecondaryCta*, aboutEyebrow*, aboutTitle, aboutParagraphs[], aboutImage, eligibilityStyle*, eligibilitySubtext*, eligibility[] {icon, text}, assistanceSubtext*, assistanceItems[] {icon, title, description}, whyChooseAirfair* {title, paragraph, points[]}, hideHelpCta*, form {title, description, submitLabel, privacyNote, sections[] {id, title, fields[]}}, seo {title, description}` (* = optional, used by SRRV).

Shared: `STANDARD_ASSISTANCE` (4 items reused by 8 services), "Need More Help?" CTA (`ServiceHelpCTA.jsx`, hardcoded), success message (`ServiceAssessmentForm.jsx`).

### 2.5 Visa hub + country pages

- **Hub** (`InternationalVisaAssistancePage.jsx`): hero H1/desc/2 CTAs/3 trust points/image; "Where Are You Planning to Travel?" + region filter tabs (`VISA_REGIONS` in `lib/visaDestinations.js`); "Can't find your destination?" strip. → `page[visa-hub].*`
- **Country records** (`lib/visaCountries.js`, 8): `japan, us, uk, canada, schengen` (featured), `australia, south-korea, singapore`.
  Fields → `visa[slug].*`: `slug, country, countryCode, flag, region, featured, visaType, title, hubTitle, hubDescription, hubCta, subtitle, description, gallery[] (Unsplash IDs map at bottom of file; overrides featuredImage), aboutParagraphs[], highlights[] {icon,title,description}, requirements[] {title, icon, required, items[], note}, faqs[] {question, answer}, relatedServices[] {title, description, image, ctaLabel, ctaHref}, inquiryForm.fields[], seo {title, description}`.
  Helpers generate defaults (`defaultHighlights`, `defaultFaqs`, `relatedTravelCard`, `baseInquiryFields`).
- Sidebar poster: static `/visa-posters/<slug>.jpg`, overridable from Storage `catalog-images/travel-package-posters/visa-<slug>/poster` ⚙.
- Hardcoded in components: form header "Apply for {title}" + copy, privacy-agree text, success text (`VisaInquiryForm.jsx`); "Need Help?" card (`VisaSupportCard.jsx`).

### 2.6 Travel & Tours

- **Hub** (`TravelToursPage.jsx` + `TravelToursHeader.jsx`): breadcrumb, H1, description, 2 CTAs, 3 trust points; promo slider of 7 package posters; search bar (destination/date/travellers; only destination filter works, date/travellers are ignored); Popular Destinations (5 records `travelDestinations[] {name, slug, packageSlug, region, shortDescription, image}`); Featured Packages (`featured` packages); promo banner image `/travel-promo-leaderboard.jpg` (links to `/#contact`).
- **Package records** (`lib/travelDestinations.js`):
  - 7 full packages (`bali-indonesia, tokyo-japan, seoul-south-korea, singapore-package, dubai-uae, sydney-australia, toronto-canada`) with fields `title, slug, featured, image, duration, inclusions[] {icon,label}, price (string), subtitle, description, heroBadge {title, subtitle}, aboutParagraphs[], packageHighlights[] {image,title,description}, whatsIncluded[], faqs[], relatedCard {…}, inquiryForm.fields[], seo`.
  - 5 homepage offers (`bts-airang-package, hong-kong-saver-getaway, singapore-saver-getaway, danang-package-tour, jeju-island-discovery`) with a smaller shape `{slug, name, place, flagCode, price, image}`, auto-expanded into detail pages with generated copy, a gallery photo map and `aboutDetails[]` (BTS only). Two currencies mixed (₱ and $).
  → all map to `travel[slug].*` with `show_on_home` / `featured` flags.
- Sidebar poster: `/travel-posters/<slug>.jpg`, overridable from Storage ⚙ (all 12 have static JPGs).
- **Orphan:** `/package/:slug` (`PackageDetailPage`) renders DB `services` products (6 placeholder packages seeded with picsum images: Japan cherry blossom etc.). No website link points to it.

### 2.7 News

- `lib/news.js`: 4 `stories` {slug, category, date, dateTime, title, description, source, initials, logo?, image, href} + 3 `guides` (external-resource cards). `lib/newsArticleContent.js`: per-slug body {intro, heading, body, takeaway, points[], outlook}. **Guides have no `articleContent`, so their `/news/<slug>` pages show "Article not found".**
- `NewsPage.jsx`: H1 "Stories worth exploring.", sub-copy, category filters (hardcoded, "Policy Updates" folded into Immigration), contact CTA block.
- `NewsArticlePage.jsx`: fixed section headings ("What this means for travelers", "Key takeaways", "Looking ahead"), figcaption, sidebar CTA.
→ `news[slug].*` + `page[news].*`.

### 2.8 Image inventory

| Asset | Used by | Notes |
|---|---|---|
| `/airfair_logo_colored.png` | Logo, news sidebar | → `settings.logo_url` |
| `/dole-logo-v2.png`, `/bi-logo-v2.png`, `/pra-logo-v2.png` | Accreditation bar (+ BI in news) | → accreditation items |
| `/srrv-retire-paradise-2.png` | SRRV banner | |
| `/travel-tours-icon.png` | Homepage tour-card overlay | |
| `/visa-icon.png` | `VisaDestinationCard` | |
| `/travel-promo-leaderboard.jpg` | Travel CTA banner | |
| `/header-rizal-park.png` | News story image | |
| `/travel-posters/*.jpg` (12), `/visa-posters/*.jpg` (8) | Default sidebar posters / promo slider | Overridable via Storage |
| `hero-slide-1..3.webp`, `image.png`, `image copy*.png` (10) | **Unused** | Cleanup candidates |
| ~60 Unsplash URLs | Hero, immigration, visa, travel, news | Hot-linked; should move to Storage/media library |
| `https://flagcdn.com/w80/<code>.png` | Flag badges | External dependency |
| `graphics/` folder | Not referenced by the app | Source/design files + poster prompt JSON |

---

## 3. Services & forms inventory

### 3.1 Services offered on the site

| Family | Items | Source of truth |
|---|---|---|
| Philippine Immigration | 13A, 9G, Tourist Visa Extension, ACR I-Card, Special Non-Immigrant, Naturalization, Deportation Assistance, Petition/Visa Reconsideration, Immigration Consultation, SRRV | `lib/immigrationServices.js` (+ 2 duplicated card lists in `Website.jsx`, `PhilippineImmigrationServices.jsx`) |
| International Tourist Visa | Japan, US, UK, Canada, Schengen, Australia, South Korea, Singapore | `lib/visaCountries.js` |
| Travel & Tours | 7 packages + 5 homepage offers | `lib/travelDestinations.js` |
| DB Catalog (`services` table) | Whatever is in the DB. Migration implies 6 placeholder products; services unknown | Supabase. Only used by the orphan `/package/:slug` |

### 3.2 Forms: all write to `form_submissions`

| Form | Location | `form_type` | Fields (✱ required, ◇ conditional) |
|---|---|---|---|
| Website contact | Homepage `#contact` | `website_inquiry` | Full name✱, Email✱, Phone, Message → `raw_data.message`. **No error shown on failure.** |
| Newsletter | Footer (all pages) | none | Email✱. **Not saved anywhere.** |
| 13A Assessment | `/philippine-immigration-services/13a-immigrant-visa` | `immigration_13a-immigrant-visa` | Personal: Full Name✱, Email✱, Phone/WhatsApp✱, Nationality✱, Current Country✱, DOB✱ · Marriage: Legally married?✱, Spouse name✱, Spouse citizenship✱, Date of marriage✱, Place✱, Registered in PH?✱ · Status: In PH?✱, Current visa◇✱, Visa expiry◇✱, Country currently in◇✱, Expected arrival◇, Previously applied 13A?✱ · Additional: Has ACR?✱, Pending case?✱, Message |
| 9G Assessment | `…/9g-working-visa` | `immigration_9g-working-visa` | Full Name✱, Email✱, Phone✱, Nationality✱, Current Country✱ · Has PH employer?✱, Company◇✱, Position◇✱, Company address◇✱, Employer contact◇, Start date✱ · In PH?✱, Current visa◇✱, Visa expiry◇✱, Has ACR?✱ · Has AEP?✱ · Previously 9G?✱, Message |
| Tourist Visa Extension | `…/tourist-visa-extension` | `immigration_tourist-visa-extension` | Full Name✱, Email✱, Phone✱, Nationality✱ · In PH?✱, Arrival date✱, Current visa✱, Visa expiry✱, Passport expiry✱ · Extension length✱, Extended before?✱, # previous◇, Has ACR?✱ · Already expired?✱, Message |
| ACR I-Card | `…/acr-i-card` | `immigration_acr-i-card` | Full Name✱, Email✱, Phone✱, Nationality✱, DOB✱, Passport #✱, Passport expiry✱ · Current visa✱, Visa expiry✱, In PH?✱, Has ACR?✱ · Help needed✱, ACR expiry◇, Message |
| Special Non-Immigrant | `…/special-non-immigrant-visa` | `immigration_special-non-immigrant-visa` | Full Name✱, Email✱, Phone✱, Nationality✱, Current Country✱ · Category✱, Sponsor org, Purpose✱ · In PH?✱, Current visa◇✱, Visa expiry◇✱, Has ACR?✱ · Previously held?✱, Message |
| Naturalization | `…/naturalization` | `immigration_naturalization` | Full Name✱, Nationality✱, DOB✱, Email✱, Contact #✱ · Years in PH✱, Current status✱, Permanent resident?✱, Has ACR?✱ · Married to Filipino?✱, Filipino children?✱, Employed/business?✱, Occupation◇, Speaks Filipino?✱, Previously applied?✱ · Additional details |
| Deportation Assistance | `…/deportation-assistance` | `immigration_deportation-assistance` | Full Name✱, Email✱, Phone/WhatsApp✱, Nationality✱ · In PH?✱, Visa status✱, Detained?✱, Deportation order?✱, Notice to Leave?✱, Active case?✱, Case #◇, Notice date, Legal rep?✱ · Urgency✱, Situation✱ |
| Visa Reconsideration | `…/visa-reconsideration` | `immigration_visa-reconsideration` | Full Name✱, Email✱, Contact #✱, Nationality✱, Current visa✱, Location✱ · Denied application✱, Decision date✱, Has copy?✱, Stated reason, Filed before?✱, Deadline · Case #, Description✱, **File upload** (decision/notice) |
| Immigration Consultation | `…/consultation` | `immigration_consultation` | Full Name✱, Email✱, Phone✱, Nationality✱, Current Country✱ · In PH?✱, Current visa◇, Help needed✱, Concern✱ · Preferred contact✱ |
| SRRV | `…/special-resident-retirees-visa` | `immigration_special-resident-retirees-visa` | Full Name✱, Email✱, Phone/WhatsApp✱, Nationality✱, DOB✱, Current Country✱ · Retired?✱, Occupation/status✱, Pension?✱, Long-term?✱ · In PH?✱, Visa◇✱, Arrival◇✱, Visa expiry◇✱, Has ACR◇✱, Expected arrival◇, Visited before◇ · Spouse included?✱, Dependents?✱, # dependents◇ · Previously applied?✱, Help needed✱, Message |
| Visa country inquiry (×8) | `/visa-assistance/<slug>` sidebar | `visa_<slug>` | Full Name✱, Email✱, Phone✱, Travel date✱, Travellers✱ (1–5+), Message; Privacy-policy checkbox✱ (links to `/#contact`, no policy page) |
| Travel package inquiry (×12) | `/travel-tours/<slug>` sidebar | `travel_package_<slug>` | Full Name✱, Email✱, Phone✱, Preferred date✱, Travellers✱, Package type✱ (Standard/Premium/Custom), Message |
| Travel search bar | `/travel-tours` | none | Destination (filters), Date, Travellers. Date and travellers are ignored |
| Dashboard login | `/dashboard` | Supabase Auth | Email, Password; Sign In / **Create Account** |

All immigration/visa/travel forms also store metadata in `raw_data`: `service_slug/country_slug/package slug`, names, `service_category`, `source_page`, `submitted_at`. Shared option lists: `lib/formOptions.js` (`VISA_TYPES`, yes/no), `lib/countries.js`.

---

## 4. Existing dashboard audit (`src/pages/Dashboard.jsx`, single 1,320-line file)

### 4.1 Shell & auth
- Supabase email/password auth. Login screen offers **Sign In and Create Account** to anyone.
- Layout: dark-navy collapsible sidebar (`T.sidebarBg #13293F`, active `#6EBE3D`), top header (label, fake search, **bell with hardcoded "3"**, avatar "AF", email, sign-out), mobile slide-out nav + bottom tab bar. Sidebar promo card uses a picsum image.
- No roles enforced in UI: every logged-in user sees every module. `employees.allowed_modules` is stored but never used to filter the sidebar.
- All data loaded once in `loadAll()`; no realtime, no refresh button.

### 4.2 Module-by-module

| Menu item | What it does | Supabase tables | Works? |
|---|---|---|---|
| **Dashboard** (Overview) | 4 stat tiles, quick actions, recent submissions, upcoming bookings, "Tasks & Reminders", mini calendar | reads `form_submissions`, `bookings`, `contacts` | **Partly.** Counts are real. "20% / 33% vs last week" hardcoded, "Pages Live 04" hardcoded, calendar hardcoded (Aug 2026, today = 26), "Tasks" is just bookings, greeting always "Good morning" |
| **Catalog** | List/filter/search services + products; editor with Service form (pricing type/price/range/duration) or Product form (slug, regular/sale price, unit, inclusions/exclusions, availability, dates); image + gallery upload; featured; Published/Draft; delete | `services` CRUD; Storage `catalog-images` | **Works (data-wise)**, but **drives nothing visible on the site** except orphan `/package/:slug`. Service form has no slug field. `category` is NOT NULL in the schema, so an empty category fails the insert and the error goes only to console. No sort ordering (grip icon is decorative). Delete has no confirmation |
| **Pipeline** | Kanban of `contacts` by stage; drag/drop and arrows; category filter; amount editor; assignee select; auto-creates tasks from stage templates | `contacts`, `employee_tasks`, `stage_task_templates`, `bookings` | **Partly broken.** Stage change is **only saved to DB if the contact has an assignee** (`handleStageChange` returns early). **Amount and assignee changes are never saved** (local state only). Lost on reload |
| **Calendar** (Bookings) | Lists bookings | `bookings` (read) | **Read-only UI.** "Add Booking" button has no handler; no edit/status change |
| **Clients** | Searchable table of contacts with stage, amount, next meeting | `contacts`, `bookings` (read) | **Works** (read-only). No detail view, no phone, no link to original submission |
| **Employees** | List/add employees, dashboard-access checkboxes, tasks (add/toggle), stage task templates | `employees`, `employee_tasks`, `stage_task_templates` | **Mostly works.** Access toggles persist but are **not enforced**. "Due" free-text input goes to a `date` column, so non-ISO strings like "Aug 29" will fail. No delete/edit employee |
| **Forms** (All forms tab) | List of 4 form templates + drag/drop form builder (palette, preview, desktop/mobile) | **none**, hardcoded `FORM_TEMPLATES` | **UI only.** Not saved, doesn't affect website forms. Settings/Submissions/Notifications/Analytics tabs are "coming soon". Table `form_templates` exists but is unused |
| **Forms** (Submissions tab) | Table of submissions with status filter, mailto, "Add to Pipeline" | `form_submissions` (read/update), `contacts` (insert) | **Works, but shallow.** Shows name/email/type/date/status only. **`raw_data` (all assessment answers, file uploads) and `phone` are never displayed.** No manual status change, no detail view, no delete/archive. `form_type` shown raw (e.g. `immigration_13a-immigrant-visa`) |
| **Forms** (Analytics tab) | Placeholder | none | UI only |
| **Media** | Grid of 8 picsum images, "Upload" button | none (`media` table unused) | **UI only / fake** |
| **Edit Website** | Page tabs → section list → field editor (hero/services_preview/testimonials/cta: heading, subheading, button text/link); image field type supported. Also hosts **Travel & Visa Posters** uploader | `pages`, `sections`, `content_blocks` (read/upsert); Storage `catalog-images/travel-package-posters/*` | **Editor saves to DB, but the website ignores 3 of the 4 sections**; only `testimonials.heading` is rendered. Poster uploader **works end-to-end** (the only fully working CMS feature). Save errors are swallowed silently |
| **Settings** | Tabs: Business, Branding, Social, SEO, Pipeline, Modules, Integrations | `site_settings` (upsert first row), `pipeline_stages` (CRUD) | **Mostly works.** Business/Social/SEO/Integrations save and the site reads them (SEO description is not applied). **Branding:** colours are static swatches; "Logo" is a plain URL text input for `logo_url`. It saves if typed into, but it isn't loaded back into the form (always shows empty), has no upload, and the website ignores it. **Modules** toggles are **never saved** (`enabled_modules` not in the save payload). Pipeline stage rename is debounced; renaming a stage doesn't migrate existing `contacts.status` values |

### 4.3 Reusable building blocks (match these in Phase 2)

| Block | Where | Notes |
|---|---|---|
| Design tokens `T`, `fontDisplay/Body/Mono` | `Dashboard.jsx:8-19` | Inter font, soft green accent, rounded-xl/2xl cards with `1px solid T.border` |
| `Badge`, `StageBadge`, `CategoryTag`, `paletteColor` | `:111-145` | Status pills |
| `LabeledInput`, `LabeledTextarea`, `LabeledSelect`, `ToggleRow` | `:294-307` | Standard form inputs |
| `ImagePickerButton` | `:308-327` | Single upload → `uploadCatalogImage` → public URL |
| `GalleryEditor` | `:328-348` | Multi-image upload + remove |
| `FieldInput` + `SECTION_FIELD_DEFS` | `:350-378` | Schema-driven section editor (text/textarea/image) — natural base for the CMS editor |
| List + editor split pane (3/5 + 2/5 grid, mobile inline editor) | Catalog `:582-610`, Edit Website `:447-475` | Standard CRUD layout |
| Modal pattern | `AddOfferingModal`, `CreateFormModal` | Overlay `rgba(21,26,34,0.45)`, rounded-2xl |
| Table pattern | Forms/Clients | Uppercase muted headers, row borders |
| Filter pills, tab bar | Catalog, Forms, Settings | |
| Form builder (`FIELD_PALETTE`, `FieldPreview`, `FormBuilderView`) | `:64-107, 616-682` | Uses a different field vocabulary (`full_name`, `single_dropdown`…) than the website renderer (`text`, `select`, `yesno`, `country`, `showWhen`). Needs reconciling |
| `TravelPosterEditor` | `components/travel/` | Tailwind-styled, different look from the rest of the dashboard |
| Website-side `DynamicFormField` | `components/immigration/` | Already schema-driven; forms can become DB-driven with little change |
| Supabase helpers | `lib/supabase.js`, `lib/content.js`, `lib/catalog.js`, `lib/travelPosters.js` | |

---

## 5. Gap analysis

### 5.1 Gap table

| Website content / feature | Dashboard component that manages it | Status |
|---|---|---|
| Business name, email, phone, address | Settings → Business | ✅ Exists and works |
| Social links | Settings → Social | ✅ Exists and works |
| Chat widget | Settings → Integrations | ✅ Exists and works |
| Currency symbol | Settings → Business | ✅ Exists and works (only used in dashboard + orphan page) |
| Travel & visa sidebar posters | Edit Website → Travel & Visa Posters | ✅ Exists and works |
| Testimonials section heading | Edit Website → Home → Testimonials | ✅ Exists and works |
| SEO title / description | Settings → SEO | 🟡 Needs changes: title only on homepage; description never applied; no per-page SEO |
| Logo | Settings → Branding | 🟡 Needs changes: URL text field only (not reloaded, no upload), website ignores it |
| Homepage hero slider | Edit Website → Home → Hero | 🟡 Needs changes: editor fields don't match the 4-slide design; site ignores DB |
| Homepage section copy (categories, immigration banner, SRRV banner, visa/travel intros, assessment, contact, news intro) | Edit Website (only `services_preview`, `cta` seeded, both unrendered) | 🟡 Needs changes: sections/field defs missing; site hardcoded |
| Testimonial cards | none | 🔴 Missing (table exists and is read by the site) |
| Testimonial stats / tagline | none | 🔴 Missing |
| Accreditation logos | none | 🔴 Missing |
| Promise bar, nav, footer columns, copyright | none | 🔴 Missing |
| Immigration hub page copy | none | 🔴 Missing |
| Immigration services (10 detail pages incl. SRRV) | Catalog (unrelated schema) | 🔴 Missing: needs per-service editor (hero, about, eligibility, assistance, why-choose, SEO) |
| Immigration assessment forms (10 schemas) | Forms builder (not connected) | 🔴 Missing: builder is local-only and uses an incompatible field model |
| Visa hub copy + region list | none | 🔴 Missing |
| Visa destinations (8) | none | 🔴 Missing: editor for highlights, requirements, FAQs, gallery, related card, featured, region |
| Visa inquiry form | none | 🔴 Missing (shared schema) |
| Travel hub copy, trust points, promo banner | none | 🔴 Missing |
| Popular destinations (5) | none | 🔴 Missing |
| Travel packages (7 + 5 offers) | Catalog → Products (writes `services`, feeds only orphan `/package/:slug`) | 🟡 Needs changes: Catalog product model lacks highlights, FAQs, hero badge, duration, icons, show-on-home, flag; site reads static file |
| Travel inquiry form | none | 🔴 Missing |
| News stories, guides, article bodies | none | 🔴 Missing |
| News page copy / categories | none | 🔴 Missing |
| Media library (all images) | Media (fake) | 🔴 Missing (UI exists, no backend) |
| Form submissions list | Forms → Submissions | 🟡 Needs changes: no detail view of `raw_data`/phone/attachments; no status edit; readable form names |
| Lead → pipeline | Forms → Add to Pipeline; Pipeline | 🟡 Needs changes: stage/amount/assignee persistence bugs |
| Clients | Clients | ✅ Works (read-only; detail view nice-to-have) |
| Bookings / calendar | Calendar | 🟡 Needs changes: create/edit booking missing |
| Employees & tasks | Employees | 🟡 Needs changes: due-date input, access not enforced |
| Newsletter signups | none | 🔴 Missing: form doesn't save; no table |
| Module toggles | Settings → Modules | 🟡 Needs changes: not persisted |
| Privacy Policy / Terms pages | none | 🔴 Missing (linked/mentioned but don't exist) |
| `/package/:slug` DB packages | Catalog | 🟡 Decision needed: retire, or merge into travel packages |

### 5.2 Proposed data model (for approval)

**Recommendation:** keep the existing tables and add **typed JSON content per entity**. Don't build a fully generic field registry.

1. **Global & page copy → existing `pages` / `sections` / `content_blocks`.**
   - Add pages `global`, `home`, `immigration-hub`, `visa-hub`, `travel-hub`, `news`.
   - Add one section per website section, using the `template_type` names in §2.
   - Repeatable lists (hero slides, steps, benefits, nav links, footer columns) are stored as a JSON string in `content_blocks.value`, with a `list` field type in the editor.
   - Keep field definitions in code (`SECTION_FIELD_DEFS`, extended). The `field_schema` table stays unused.
   - Every field keeps the **current hardcoded value as its fallback**, so the site never goes blank.
2. **Entities → one new table `site_entries`** (`id, kind ['immigration_service'|'visa_destination'|'travel_package'|'travel_destination'|'news_article'], slug, title, status ['Published','Draft'], featured, show_on_home, sort_order, content jsonb, seo_title, seo_description, updated_at`, unique `(kind, slug)`).
   - Alternative: extend `services` with `template_type` + `content jsonb`. This reuses the Catalog UI, but it mixes CRM pricing fields with page content and collides with the 6 placeholder products.
   - Either choice needs a one-time **seed migration generated from the current `src/lib/*.js` files**, so launch-day content is identical.
3. **Forms → existing `form_templates`** (`form_type` = `immigration_<slug>` / `visa_inquiry` / `travel_inquiry` / `website_inquiry`).
   - `fields` jsonb uses the **website's** schema (`sections[].fields[] {name,label,type,required,options,showWhen,placeholder}`).
   - The dashboard builder gets rewritten to that vocabulary.
   - The website falls back to the code schema if no row exists.
4. **Testimonials → existing `testimonials`.** Add a CRUD screen.
5. **Media → existing `media` table + `catalog-images` bucket.** The Media page lists and uploads here. `ImagePickerButton` gains a "choose from library" option.
6. **Newsletter → new `newsletter_subscribers`** (public insert only). Alternative: `form_submissions` with `form_type='newsletter'`, which needs no schema change.
7. **Settings → existing `site_settings`.** Add a logo upload and persist `enabled_modules`; apply `seo_description`.

### 5.3 Components to build or modify

| # | Component | Build / modify | Description |
|---|---|---|---|
| C1 | `lib/cms.js` (website) | Build | `useSiteContent(pageSlug)` / `useEntries(kind)` / `useEntry(kind, slug)` hooks with in-code fallbacks; small cache so pages don't flash |
| C2 | Website sections | Modify | Swap hardcoded consts for CMS values, **no markup/CSS changes**: `Website.jsx` sections, `PhilippineImmigrationServices.jsx`, hub pages, `NewsEvents`, `NewsPage`, `NewsArticlePage`, detail pages (data shapes stay identical, source changes) |
| C3 | Edit Website v2 | Modify `EditWebsite` | Page tabs for all pages; extended `SECTION_FIELD_DEFS` covering every §2 section; new field types `list` (repeatable rows with reorder), `image` (library/upload), `url`, `icon` (picker from `icons.js`); visibility toggle; unsaved-changes guard; error surfacing; "View page" link |
| C4 | Immigration Services manager | Build (Catalog-style split pane) | List of 10 services → tabbed editor: Hero · About · Eligibility · Assistance · Why choose · Form (links C7) · SEO · Publish |
| C5 | Visa Destinations manager | Build | List → editor: Card (hub title/desc/CTA/region/featured/flag) · Intro · Gallery · About · Highlights · Requirements (grouped items + note) · FAQs · Related card · Poster (embed `TravelPosterEditor` logic) · SEO |
| C6 | Travel manager | Build | Tabs **Packages** (full shape incl. duration, price text, inclusions icons, hero badge, highlights with images, what's included, FAQs, related card, show-on-home/featured, poster) and **Popular Destinations** |
| C7 | Form builder v2 | Rewrite `FormBuilderView` | Persist to `form_templates`; website field vocabulary incl. `country`, `yesno`, `file`, sections, `showWhen` conditions; preview uses the real `DynamicFormField` |
| C8 | Submissions inbox v2 | Modify Forms → Submissions | Row click opens a detail drawer showing all `raw_data` answers labelled via the form schema, phone, attachments, source page; status dropdown; archive; readable form names; filters by form family |
| C9 | Testimonials manager | Build | CRUD + publish + reorder + photo; stats/tagline edited in C3 |
| C10 | News manager | Build | Stories/guides CRUD: card fields + article body (intro, heading, body, takeaway, points[], outlook), source, date, image, category, featured |
| C11 | Media library | Rewrite `Media` | Real uploads to `catalog-images`, rows in `media`, alt text, delete, copy URL; reused as picker |
| C12 | Settings fixes | Modify | Logo upload (`ImagePickerButton`), persist `enabled_modules`, promise-bar/footer could live here or in C3 |
| C13 | Pipeline persistence fixes | Modify | Always persist stage; persist amount + assignee; stop double task creation (see R4) |
| C14 | Bookings create/edit | Modify `Bookings` | Wire "Add Booking" modal to `bookings` insert/update |
| C15 | Auth hardening | Modify | Remove/disable public "Create Account"; introduce `profiles.role` check (see R1) |
| C16 | Sidebar entries | Modify `NAV` | Group: *Website* (Edit Website, Immigration, Visa, Travel, News, Testimonials, Media) · *CRM* (Pipeline, Clients, Calendar, Forms, Employees) · Settings |
| C17 | Migrations | Build | `site_entries` (or `services` extension), RLS for new tables (public read Published / authenticated write), newsletter, `form-attachments` bucket, seed data generated from `src/lib/*.js` |

---

## 6. Supabase, auth & CRM: current state

### 6.1 Tables (from `database-schema.sql` v2 + migrations)

| Table | Used by site | Used by dashboard | RLS (per `20260913150000_lock_down_rls_policies.sql`) |
|---|---|---|---|
| `site_settings` | read | read/write | public read, authenticated all |
| `pages`, `sections`, `content_blocks` | read | read/write | public read, authenticated all |
| `testimonials` | read (`is_published`) | — | public read (**all rows, incl. unpublished**), authenticated all |
| `services` | read Published (orphan route) | CRUD | anon: Published only; authenticated all |
| `service_fields`, `field_schema` | — | — | authenticated only (unused) |
| `faqs`, `media`, `form_templates`, `form_field_mappings` | — | — | authenticated only (unused) |
| `form_submissions` | insert | read/update | public insert; authenticated read/update/delete |
| `contacts`, `bookings`, `employees`, `employee_tasks`, `stage_task_templates`, `pipeline_stages` | — | read/write | authenticated all |
| `profiles` | — | — | authenticated read; own-row update. No insert trigger visible |

**Storage:** `catalog-images` (public, 5 MB, jpeg/png/webp/gif; authenticated write), also used for posters under `travel-package-posters/<slug>/poster`. **`form-attachments` bucket is referenced in code but no migration creates it** (see R5).

**DB automation in `database-schema.sql`:**
- `trg_auto_create_contact` on `form_submissions` insert. Creates a contact if a `form_field_mappings` row exists for that `form_type`; no rows are known to exist.
- `trg_auto_assign_stage_tasks` on `contacts.status` update. Inserts tasks from templates.

### 6.2 Auth
- Supabase email/password. Single tier: **any authenticated user = full access** to everything (RLS `TO authenticated USING (true)`).
- `profiles.role` (`super_admin|client|staff`) and `employees.user_id` / `allowed_modules` exist, but nothing enforces them.

### 6.3 CRM flow today
Website form → `form_submissions` (status `New`) → staff clicks **Add to Pipeline** → `contacts` row (stage = first pipeline stage, category guessed from `form_type` against Catalog categories) and submission set to `Contacted` → Kanban stages → optional employee assignment → stage templates generate `employee_tasks`. Bookings link to contacts but can't be created from the UI.

---

## 7. Risks & unclear points

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| R1 | 🔴 Critical | **Open sign-up + blanket authenticated RLS.** Anyone can hit `/dashboard` → Create Account → read every lead's personal data (passport numbers, detention status, DOB), edit the website, delete catalog. Unless email sign-ups are disabled in the Supabase project settings (**can't verify from code, please confirm**). | Disable sign-ups in Supabase Auth; remove the tab; gate RLS on `profiles.role` / an allow-list. Do this first, before adding more CMS write surfaces |
| R2 | 🔴 High | Submitted assessment answers (`raw_data`) are invisible in the dashboard. Staff can't action leads without querying the DB directly | C8 |
| R3 | 🟠 High | Pipeline stage changes for unassigned contacts, amounts and assignees are not persisted | C13 |
| R4 | 🟠 Medium | If the DB trigger `trg_auto_assign_stage_tasks` is live, stage changes create **duplicate tasks** (trigger + JS `handleStageChange` both insert) | Confirm live schema; keep one mechanism |
| R5 | 🟠 Medium | `form-attachments` bucket not created by any migration. If it's missing, the Reconsideration upload silently stores only the filename. Also, if created as public, sensitive immigration documents would be world-readable via URL | Create a **private** bucket + signed URLs for staff |
| R6 | 🟠 Medium | **Live schema unknown.** Migrations only seed/alter; base tables come from `database-schema.sql` run manually (its own header references v1/v2 files that aren't in the repo). The actual DB may differ | Before Phase 2: dump the live schema (`supabase db dump` or SQL editor) so migrations are written against reality |
| R7 | 🟡 Medium | `testimonials` public policy exposes unpublished rows to anon (site filters client-side) | Tighten policy to `is_published = true` for anon |
| R8 | 🟡 Medium | Chat widget code is injected as raw script. Any dashboard user can run arbitrary JS on the public site (compounded by R1) | Acceptable once R1 fixed; restrict to admin role |
| R9 | 🟡 Medium | Content duplication: the immigration list exists 3× (homepage, hub, data file); the travel offers have two different shapes | CMS migration consolidates to one record per service |
| R10 | 🟡 Medium | Two field vocabularies (dashboard builder vs website `DynamicFormField`) | Standardise on the website's (C7) |
| R11 | 🟡 Decision | `services` table / Catalog: keep as the CRM "price list" and retire `/package/:slug`? Or merge travel packages into it? Six picsum-image placeholder products are currently Published | **Your call.** Recommendation: keep Catalog for pricing/CRM categories, move page content to `site_entries`, and retire `/package/:slug` (redirect to `/travel-tours`) |
| R12 | 🟡 Decision | How much should be editable? Icons, theme colours, hero timing, section order/visibility? | Recommendation: text, images, links, list items, visibility, order of list items. Keep layout, colours and section order locked (matches "Layout and design stay locked" copy already in the dashboard) |
| R13 | 🟡 Low | Content correctness: typo "Aitfair" (`Website.jsx:120`); mixed ₱/$ prices; copyright "© 2025"; footer links all go to the same anchors; guides' article pages 404; "Privacy Policy" links to `/#contact`; mock "browser bar" strip visible on the live site | Fix during content migration (content-only changes, with your OK) |
| R14 | 🟡 Low | Hot-linked Unsplash images and flagcdn: availability/licensing outside your control | Move to Storage via Media library over time |
| R15 | 🟡 Low | Uncommitted working-tree edits (`Website.jsx`: TrustBar removed, assessment redesign) and committed `dist/` build | Commit/confirm before Phase 2 so the CMS work builds on the intended design |
| R16 | 🟡 Low | `Dashboard.jsx` is one 1,320-line file | Phase 2 new modules go in `src/dashboard/*` files, reusing extracted shared primitives (tokens, inputs, pickers) without changing their look |
| R17 | ℹ️ | Legacy `air-fair-website.jsx`, `client-dashboard.jsx`, unused `public/image*.png` and `hero-slide-*.webp` | Leave untouched unless you want cleanup |

### Questions for you before Phase 2
1. Are Supabase **email sign-ups disabled** in the project dashboard? Who should have dashboard access (just you/owner, or staff with limited modules)?
2. Content model: approve the **`site_entries` table (recommended)**, or prefer extending `services`?
3. What should happen to the **Catalog products** and `/package/:slug`?
4. Scope of editability per R12, and should **forms be editable** (C7) in this phase or later?
5. Can you share a **live schema dump**, or should Phase 2 begin with a read-only schema check?
6. Priority order. Suggested: R1 security → C8 submissions inbox + C13 pipeline fixes → C1/C3 site copy → C4–C6 entities → C9–C11 → C7 forms.
