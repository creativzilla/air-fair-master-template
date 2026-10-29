# Form identifiers

Every website form submission is tagged with three identifiers, stored as
columns on `form_submissions` and `newsletter_subscribers`
(migration `20260927130000_form_identifiers.sql`):

- **form_id**: unique per form and page (table below).
- **service_type**: `general`, `newsletter`, `immigration`, `visa` or `travel`.
- **source**: the page path the form was sent from.

The website sends them with each submission; the database fills them in if
they are missing (worked out from the older `form_type`), so every row has
them. `form_key` (the CMS form definition) and `form_type` are unchanged.

New pages created in the dashboard get their form_id automatically from the
same pattern (e.g. a new visa country `vietnam` gets `visa-inquiry-vietnam`).

| form_id | service_type | Page | Form | form_key (CMS form) | form_type (legacy) |
|---|---|---|---|---|---|
| `contact-home` | general | Homepage (`/#contact`) | Contact form | `website-contact` | `website_inquiry` |
| `newsletter-footer` | newsletter | Footer, every page | Newsletter signup | – | – |
| `immigration-13a-immigrant-visa` | immigration | `/philippine-immigration-services/13a-immigrant-visa` | 13A Immigrant Visa by Marriage assessment | `immigration-13a-immigrant-visa` | `immigration_13a-immigrant-visa` |
| `immigration-9g-working-visa` | immigration | `/philippine-immigration-services/9g-working-visa` | Pre-Arranged Working Visa (9G) assessment | `immigration-9g-working-visa` | `immigration_9g-working-visa` |
| `immigration-acr-i-card` | immigration | `/philippine-immigration-services/acr-i-card` | ACR I-Card assessment | `immigration-acr-i-card` | `immigration_acr-i-card` |
| `immigration-consultation` | immigration | `/philippine-immigration-services/consultation` | Immigration-Related Consultation assessment | `immigration-consultation` | `immigration_consultation` |
| `immigration-deportation-assistance` | immigration | `/philippine-immigration-services/deportation-assistance` | Deportation Assistance assessment | `immigration-deportation-assistance` | `immigration_deportation-assistance` |
| `immigration-naturalization` | immigration | `/philippine-immigration-services/naturalization` | Naturalization assessment | `immigration-naturalization` | `immigration_naturalization` |
| `immigration-special-non-immigrant-visa` | immigration | `/philippine-immigration-services/special-non-immigrant-visa` | Special Non-Immigrant Visa assessment | `immigration-special-non-immigrant-visa` | `immigration_special-non-immigrant-visa` |
| `immigration-special-resident-retirees-visa` | immigration | `/philippine-immigration-services/special-resident-retirees-visa` | Special Resident Retiree's Visa (SRRV) assessment | `immigration-special-resident-retirees-visa` | `immigration_special-resident-retirees-visa` |
| `immigration-tourist-visa-extension` | immigration | `/philippine-immigration-services/tourist-visa-extension` | Tourist Visa Extension assessment | `immigration-tourist-visa-extension` | `immigration_tourist-visa-extension` |
| `immigration-visa-reconsideration` | immigration | `/philippine-immigration-services/visa-reconsideration` | Petition / Visa Reconsideration assessment | `immigration-visa-reconsideration` | `immigration_visa-reconsideration` |
| `visa-inquiry-australia` | visa | `/visa-assistance/australia` | Australia Visitor Visa inquiry | `visa-inquiry` | `visa_australia` |
| `visa-inquiry-canada` | visa | `/visa-assistance/canada` | Canada Visitor Visa inquiry | `visa-inquiry` | `visa_canada` |
| `visa-inquiry-japan` | visa | `/visa-assistance/japan` | Japan Tourist Visa inquiry | `visa-inquiry` | `visa_japan` |
| `visa-inquiry-schengen` | visa | `/visa-assistance/schengen` | Schengen Visa inquiry | `visa-inquiry` | `visa_schengen` |
| `visa-inquiry-singapore` | visa | `/visa-assistance/singapore` | Singapore Visit Pass inquiry | `visa-inquiry` | `visa_singapore` |
| `visa-inquiry-south-korea` | visa | `/visa-assistance/south-korea` | South Korea Tourist Visa inquiry | `visa-inquiry` | `visa_south-korea` |
| `visa-inquiry-uk` | visa | `/visa-assistance/uk` | UK Standard Visitor Visa inquiry | `visa-inquiry` | `visa_uk` |
| `visa-inquiry-us` | visa | `/visa-assistance/us` | US Tourist Visa inquiry | `visa-inquiry` | `visa_us` |
| `travel-inquiry-bali-indonesia` | travel | `/travel-tours/bali-indonesia` | Bali, Indonesia inquiry | `travel-inquiry` | `travel_package_bali-indonesia` |
| `travel-inquiry-bts-airang-package` | travel | `/travel-tours/bts-airang-package` | BTS Airang Package inquiry | `travel-inquiry` | `travel_package_bts-airang-package` |
| `travel-inquiry-danang-package-tour` | travel | `/travel-tours/danang-package-tour` | Danang Package Tour inquiry | `travel-inquiry` | `travel_package_danang-package-tour` |
| `travel-inquiry-dubai-uae` | travel | `/travel-tours/dubai-uae` | Dubai, UAE inquiry | `travel-inquiry` | `travel_package_dubai-uae` |
| `travel-inquiry-hong-kong-saver-getaway` | travel | `/travel-tours/hong-kong-saver-getaway` | Hong Kong Saver Getaway inquiry | `travel-inquiry` | `travel_package_hong-kong-saver-getaway` |
| `travel-inquiry-jeju-island-discovery` | travel | `/travel-tours/jeju-island-discovery` | Jeju Island Discovery inquiry | `travel-inquiry` | `travel_package_jeju-island-discovery` |
| `travel-inquiry-seoul-south-korea` | travel | `/travel-tours/seoul-south-korea` | Seoul, South Korea inquiry | `travel-inquiry` | `travel_package_seoul-south-korea` |
| `travel-inquiry-singapore-package` | travel | `/travel-tours/singapore-package` | Singapore inquiry | `travel-inquiry` | `travel_package_singapore-package` |
| `travel-inquiry-singapore-saver-getaway` | travel | `/travel-tours/singapore-saver-getaway` | Singapore Saver Getaway inquiry | `travel-inquiry` | `travel_package_singapore-saver-getaway` |
| `travel-inquiry-sydney-australia` | travel | `/travel-tours/sydney-australia` | Sydney, Australia inquiry | `travel-inquiry` | `travel_package_sydney-australia` |
| `travel-inquiry-tokyo-japan` | travel | `/travel-tours/tokyo-japan` | Tokyo, Japan inquiry | `travel-inquiry` | `travel_package_tokyo-japan` |
| `travel-inquiry-toronto-canada` | travel | `/travel-tours/toronto-canada` | Toronto, Canada inquiry | `travel-inquiry` | `travel_package_toronto-canada` |
