/*
# Populate product packages with slugs and placeholder details

1. Updated table: services (type = 'product')
   - Adds slugs to all 6 existing product packages so each one has a working
     detail page URL on the website (e.g. /package/boracay-island-escape).
   - Fills in generic placeholder content for short_description,
     full_description, regular_price, sale_price, pricing_unit, gallery,
     inclusions, exclusions, availability, start_date, end_date, cta_label,
     and cta_link for every product that was missing these fields.
   - Publishes the one Draft product (Korea Autumn Package) so all six
     packages show on the website.
2. Security: no RLS or policy changes.
*/

UPDATE services SET
  slug = 'japan-cherry-blossom-6d5n',
  short_description = COALESCE(NULLIF(short_description, ''), 'Experience the breathtaking beauty of Japan during peak sakura season. Visit Tokyo, Osaka, and Kyoto with guided tours, comfortable accommodations, and seamless transfers.'),
  full_description = COALESCE(NULLIF(full_description, ''), 'Join us on an unforgettable 6-day, 5-night journey through Japan''s most iconic cities during cherry blossom season. This all-inclusive package covers round-trip flights, hotel accommodations, daily breakfast, guided city tours, and airport transfers. Witness the stunning sakura in full bloom as you explore ancient temples, modern cityscapes, and serene gardens. Perfect for couples, families, and solo travelers looking for a hassle-free Japanese adventure.'),
  regular_price = COALESCE(regular_price, 45000),
  sale_price = COALESCE(sale_price, 39800),
  pricing_unit = COALESCE(NULLIF(pricing_unit, ''), 'per person'),
  gallery = CASE WHEN gallery IS NULL OR gallery = '[]'::jsonb THEN '["https://picsum.photos/seed/japan-sakura-1/640/420","https://picsum.photos/seed/japan-temple-2/640/420","https://picsum.photos/seed/japan-city-3/640/420"]'::jsonb ELSE gallery END,
  image_url = COALESCE(NULLIF(image_url, ''), 'https://picsum.photos/seed/japan-cherry-blossom-hero/640/420'),
  inclusions = COALESCE(NULLIF(inclusions, ''), 'Round-trip airfare from Manila
5 nights hotel accommodation with daily breakfast
Guided city tours in Tokyo, Osaka, and Kyoto
Airport transfers and intercity transportation
Travel insurance
English-speaking tour guide'),
  exclusions = COALESCE(NULLIF(exclusions, ''), 'Philippine travel tax and terminal fee
Japan visa application fee
Lunches and dinners
Personal expenses and souvenirs
Optional tours and activities'),
  availability = COALESCE(NULLIF(availability, ''), 'Departures: March to April 2026'),
  start_date = COALESCE(start_date, '2026-03-15'),
  end_date = COALESCE(end_date, '2026-03-20'),
  cta_label = COALESCE(NULLIF(cta_label, ''), 'Book Now'),
  cta_link = COALESCE(NULLIF(cta_link, ''), '#contact'),
  status = 'Published'
WHERE name = 'Japan Cherry Blossom 6D5N';

UPDATE services SET
  slug = 'korea-autumn-package-5d4n',
  short_description = COALESCE(NULLIF(short_description, ''), 'Discover the vibrant autumn colors of South Korea. Explore Seoul''s palaces, Bukchon Hanok Village, and Nami Island on this 5-day cultural adventure.'),
  full_description = COALESCE(NULLIF(full_description, ''), 'Immerse yourself in the beauty of South Korea during autumn. This 5-day, 4-night package takes you through Seoul''s historic palaces, the picturesque Bukchon Hanok Village, the enchanting Nami Island, and more. Enjoy comfortable accommodations, daily breakfast, and guided tours led by knowledgeable local experts. Round-trip flights and airport transfers are included for a stress-free experience.'),
  regular_price = COALESCE(regular_price, 35000),
  sale_price = COALESCE(sale_price, 29800),
  pricing_unit = COALESCE(NULLIF(pricing_unit, ''), 'per person'),
  gallery = CASE WHEN gallery IS NULL OR gallery = '[]'::jsonb THEN '["https://picsum.photos/seed/korea-autumn-1/640/420","https://picsum.photos/seed/korea-palace-2/640/420","https://picsum.photos/seed/korea-nami-3/640/420"]'::jsonb ELSE gallery END,
  image_url = COALESCE(NULLIF(image_url, ''), 'https://picsum.photos/seed/korea-autumn-hero/640/420'),
  inclusions = COALESCE(NULLIF(inclusions, ''), 'Round-trip airfare from Manila
4 nights hotel accommodation with daily breakfast
Guided tours of Seoul and Nami Island
Airport transfers
Travel insurance
English-speaking tour guide'),
  exclusions = COALESCE(NULLIF(exclusions, ''), 'Philippine travel tax and terminal fee
Korea visa application fee
Lunches and dinners
Personal expenses and souvenirs
Optional tours and activities'),
  availability = COALESCE(NULLIF(availability, ''), 'Departures: October to November 2026'),
  start_date = COALESCE(start_date, '2026-10-15'),
  end_date = COALESCE(end_date, '2026-10-19'),
  cta_label = COALESCE(NULLIF(cta_label, ''), 'Book Now'),
  cta_link = COALESCE(NULLIF(cta_link, ''), '#contact'),
  status = 'Published'
WHERE name = 'Korea Autumn Package 5D4N';

UPDATE services SET
  slug = 'puerto-princesa-getaway',
  short_description = COALESCE(NULLIF(short_description, ''), 'Explore the world-famous Underground River, Honda Bay islands, and the natural wonders of Puerto Princesa, Palawan on this 3-day getaway.'),
  full_description = COALESCE(NULLIF(full_description, ''), 'Escape to Puerto Princesa, Palawan for a 3-day, 2-night adventure featuring the UNESCO World Heritage Underground River, island hopping at Honda Bay, and a city tour. This package includes hotel accommodation, daily breakfast, all tours with licensed guides, and round-trip airport transfers. Experience the natural beauty and biodiversity of one of the Philippines'' top destinations.'),
  regular_price = COALESCE(regular_price, 9500),
  sale_price = COALESCE(sale_price, 7800),
  pricing_unit = COALESCE(NULLIF(pricing_unit, ''), 'per person'),
  gallery = CASE WHEN gallery IS NULL OR gallery = '[]'::jsonb THEN '["https://picsum.photos/seed/puertoprincesa-river-1/640/420","https://picsum.photos/seed/puertoprincesa-island-2/640/420","https://picsum.photos/seed/puertoprincesa-beach-3/640/420"]'::jsonb ELSE gallery END,
  image_url = COALESCE(NULLIF(image_url, ''), 'https://picsum.photos/seed/puerto-princesa-hero/640/420'),
  inclusions = COALESCE(NULLIF(inclusions, ''), '2 nights hotel accommodation with daily breakfast
Underground River tour with permit
Honda Bay island hopping tour
City tour
Round-trip airport transfers
Licensed tour guide'),
  exclusions = COALESCE(NULLIF(exclusions, ''), 'Round-trip airfare to Puerto Princesa
Terminal fees
Lunches and dinners
Personal expenses and souvenirs
Optional activities'),
  availability = COALESCE(NULLIF(availability, ''), 'Year-round, daily departures'),
  start_date = COALESCE(start_date, '2026-01-01'),
  end_date = COALESCE(end_date, '2026-12-31'),
  cta_label = COALESCE(NULLIF(cta_label, ''), 'Book Now'),
  cta_link = COALESCE(NULLIF(cta_link, ''), '#contact'),
  status = 'Published'
WHERE name = 'Puerto Princesa Getaway';

UPDATE services SET
  slug = 'boracay-island-escape',
  short_description = COALESCE(NULLIF(short_description, ''), 'Relax on the powdery white sand of Boracay''s world-famous beaches. 3 days, 2 nights of sun, sea, and fun with island hopping and water activities.'),
  full_description = COALESCE(NULLIF(full_description, ''), 'Experience Boracay''s stunning White Beach on this 3-day, 2-night island escape. Your package includes beachfront hotel accommodation, daily breakfast, an island hopping tour with snorkeling, and a sunset sail. Enjoy crystal-clear waters, vibrant marine life, and Boracay''s famous nightlife. Airport transfers to and from Caticlan or Kalibo are included for a seamless getaway.'),
  regular_price = COALESCE(regular_price, 9500),
  sale_price = COALESCE(sale_price, 7500),
  pricing_unit = COALESCE(NULLIF(pricing_unit, ''), 'per person'),
  gallery = CASE WHEN gallery IS NULL OR gallery = '[]'::jsonb THEN '["https://picsum.photos/seed/boracay-beach-1/640/420","https://picsum.photos/seed/boracay-sunset-2/640/420","https://picsum.photos/seed/boracay-island-3/640/420"]'::jsonb ELSE gallery END,
  image_url = COALESCE(NULLIF(image_url, ''), 'https://picsum.photos/seed/boracay-island-hero/640/420'),
  inclusions = COALESCE(NULLIF(inclusions, ''), '2 nights beachfront hotel accommodation with daily breakfast
Island hopping tour with snorkeling
Sunset sailing
Round-trip airport transfers
Travel insurance'),
  exclusions = COALESCE(NULLIF(exclusions, ''), 'Round-trip airfare to Caticlan/Kalibo
Terminal and environmental fees
Lunches and dinners
Water sports and optional activities
Personal expenses'),
  availability = COALESCE(NULLIF(availability, ''), 'Year-round, daily departures'),
  start_date = COALESCE(start_date, '2026-01-01'),
  end_date = COALESCE(end_date, '2026-12-31'),
  cta_label = COALESCE(NULLIF(cta_label, ''), 'Book Now'),
  cta_link = COALESCE(NULLIF(cta_link, ''), '#contact'),
  status = 'Published'
WHERE name = 'Boracay Island Escape';

UPDATE services SET
  slug = 'el-nido-palawan-adventure',
  short_description = COALESCE(NULLIF(short_description, ''), 'Discover the stunning lagoons, hidden beaches, and limestone cliffs of El Nido, Palawan. 4 days, 3 nights of island hopping and adventure.'),
  full_description = COALESCE(NULLIF(full_description, ''), 'Embark on a 4-day, 3-night adventure in El Nido, Palawan — voted one of the world''s most beautiful islands. This package includes island hopping tours (Tour A and Tour C), visiting the Big and Small Lagoons, Secret Beach, and Hidden Beach. Stay in a comfortable beachfront hotel with daily breakfast. Snorkeling gear, licensed guides, and round-trip airport transfers are all included.'),
  regular_price = COALESCE(regular_price, 14500),
  sale_price = COALESCE(sale_price, 12000),
  pricing_unit = COALESCE(NULLIF(pricing_unit, ''), 'per person'),
  gallery = CASE WHEN gallery IS NULL OR gallery = '[]'::jsonb THEN '["https://picsum.photos/seed/elnido-lagoon-1/640/420","https://picsum.photos/seed/elnido-beach-2/640/420","https://picsum.photos/seed/elnido-cliffs-3/640/420"]'::jsonb ELSE gallery END,
  image_url = COALESCE(NULLIF(image_url, ''), 'https://picsum.photos/seed/el-nido-hero/640/420'),
  inclusions = COALESCE(NULLIF(inclusions, ''), '3 nights hotel accommodation with daily breakfast
Island hopping Tour A (Big Lagoon, Secret Lagoon, Shimizu Island)
Island hopping Tour C (Hidden Beach, Matloc Island, Star Beach)
Snorkeling gear and licensed guide
Round-trip airport transfers
Travel insurance'),
  exclusions = COALESCE(NULLIF(exclusions, ''), 'Round-trip airfare to El Nido/Puerto Princesa
Eco-tourism development fee
Lunches and dinners
Kayak and paddleboard rentals
Personal expenses'),
  availability = COALESCE(NULLIF(availability, ''), 'Year-round, daily departures'),
  start_date = COALESCE(start_date, '2026-01-01'),
  end_date = COALESCE(end_date, '2026-12-31'),
  cta_label = COALESCE(NULLIF(cta_label, ''), 'Book Now'),
  cta_link = COALESCE(NULLIF(cta_link, ''), '#contact'),
  status = 'Published'
WHERE name = 'El Nido, Palawan Adventure';

UPDATE services SET
  slug = 'escape-to-central-vietnam',
  short_description = COALESCE(NULLIF(short_description, ''), 'Journey through Central Vietnam — Da Nang, Hoi An, and Hue. 5 days, 4 nights of rich culture, ancient towns, and stunning landscapes.'),
  full_description = COALESCE(NULLIF(full_description, ''), 'Explore the cultural heart of Vietnam on this 5-day, 4-night Central Vietnam adventure. Visit the ancient trading town of Hoi An (a UNESCO World Heritage site), the imperial city of Hue, the Marble Mountains, and the golden sands of My Khe Beach in Da Nang. Package includes hotel accommodation, daily breakfast, all tours with English-speaking guides, round-trip flights, and airport transfers.'),
  regular_price = COALESCE(regular_price, 28000),
  sale_price = COALESCE(sale_price, 24800),
  pricing_unit = COALESCE(NULLIF(pricing_unit, ''), 'per person'),
  gallery = CASE WHEN gallery IS NULL OR gallery = '[]'::jsonb THEN '["https://picsum.photos/seed/vietnam-hoian-1/640/420","https://picsum.photos/seed/vietnam-danang-2/640/420","https://picsum.photos/seed/vietnam-hue-3/640/420"]'::jsonb ELSE gallery END,
  image_url = COALESCE(NULLIF(image_url, ''), 'https://picsum.photos/seed/vietnam-central-hero/640/420'),
  inclusions = COALESCE(NULLIF(inclusions, ''), 'Round-trip airfare from Manila
4 nights hotel accommodation with daily breakfast
Hoi An ancient town guided tour
Hue imperial city tour
Marble Mountains visit
Airport transfers
English-speaking tour guide'),
  exclusions = COALESCE(NULLIF(exclusions, ''), 'Philippine travel tax and terminal fee
Vietnam visa application fee
Lunches and dinners
Personal expenses and souvenirs
Optional tours and activities'),
  availability = COALESCE(NULLIF(availability, ''), 'Departures: Year-round, monthly schedules'),
  start_date = COALESCE(start_date, '2026-01-01'),
  end_date = COALESCE(end_date, '2026-12-31'),
  cta_label = COALESCE(NULLIF(cta_label, ''), 'Book Now'),
  cta_link = COALESCE(NULLIF(cta_link, ''), '#contact'),
  status = 'Published'
WHERE name = 'Escape to Central Vietnam';
