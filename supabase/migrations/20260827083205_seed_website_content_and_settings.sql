/*
# Seed initial website content and settings

1. Purpose
   - Populate pages/sections/content_blocks with the Home page hero, services preview, testimonials header, and CTA section so the Edit Website page has real editable content.
   - Populate testimonials table with 3 placeholder testimonials matching the current hardcoded ones.
   - Insert a single row in site_settings with the business info currently hardcoded in the website footer and settings page.

2. New Data
   - pages: 1 row (slug='home')
   - sections: 4 rows (hero, services-preview, testimonials, cta) under the home page
   - content_blocks: editable fields for each section (heading, subheading, cta_text, cta_url, etc.)
   - testimonials: 3 rows with placeholder quotes
   - site_settings: 1 row with business name, contact email/phone, address, social URLs, SEO defaults, currency, chat widget placeholder

3. Security
   - No schema changes. All tables already have anon RLS policies allowing public read.
   - This migration only inserts data rows.
*/

-- ---------------------------------------------------------------------------
-- Pages + Sections + Content Blocks for the Home page
-- ---------------------------------------------------------------------------
INSERT INTO pages (slug, title, is_published, sort_order)
VALUES ('home', 'Home', true, 0)
ON CONFLICT (slug) DO NOTHING;

-- We need the page id for FK references. Use a CTE to grab it.
DO $$
DECLARE
  v_page_id uuid;
BEGIN
  SELECT id INTO v_page_id FROM pages WHERE slug = 'home';

  -- Section: hero
  INSERT INTO sections (page_id, template_type, sort_order, is_visible)
  VALUES (v_page_id, 'hero', 0, true)
  ON CONFLICT DO NOTHING;

  -- Section: services-preview
  INSERT INTO sections (page_id, template_type, sort_order, is_visible)
  VALUES (v_page_id, 'services_preview', 1, true)
  ON CONFLICT DO NOTHING;

  -- Section: testimonials
  INSERT INTO sections (page_id, template_type, sort_order, is_visible)
  VALUES (v_page_id, 'testimonials', 2, true)
  ON CONFLICT DO NOTHING;

  -- Section: cta
  INSERT INTO sections (page_id, template_type, sort_order, is_visible)
  VALUES (v_page_id, 'cta', 3, true)
  ON CONFLICT DO NOTHING;

  -- Content blocks for hero section
  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'heading', 'Your visa, handled right.'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'hero'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'subheading', 'From tourist visas to permanent residency, Air Fair takes the paperwork off your plate — so you can focus on the trip, not the process.'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'hero'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'cta_text', 'Book a Free Consultation'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'hero'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'cta_url', '#contact'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'hero'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  -- Content blocks for services-preview section
  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'heading', 'Every step of your journey, covered.'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'services_preview'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'subheading', 'Pick a service on its own, or let us manage the full process from consultation to approval.'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'services_preview'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  -- Content blocks for testimonials section
  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'heading', 'Trusted by travelers and families alike.'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'testimonials'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  -- Content blocks for cta section
  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'heading', 'Ready to start your journey?'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'cta'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'subheading', 'Book a free consultation and we''ll map out what your case needs.'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'cta'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'cta_text', 'Get a Free Consultation'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'cta'
  ON CONFLICT (section_id, field_key) DO NOTHING;

  INSERT INTO content_blocks (section_id, field_key, value)
  SELECT s.id, 'cta_url', '#contact'
  FROM sections s WHERE s.page_id = v_page_id AND s.template_type = 'cta'
  ON CONFLICT (section_id, field_key) DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- Testimonials
-- ---------------------------------------------------------------------------
INSERT INTO testimonials (client_name, quote, service_category, is_published, sort_order)
VALUES
  ('Marisol C.', 'Air Fair walked me through every requirement for my tourist visa. No surprises at the embassy.', 'Visa', true, 0),
  ('Jonas R.', 'They handled my work permit application while I focused on my job offer. Smooth from start to finish.', 'Immigration Processing', true, 1),
  ('Grace L.', 'Booked our whole family''s flights and hotel in one call. Saved us so much time.', 'Flight & Hotel', true, 2)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Site Settings (single row)
-- ---------------------------------------------------------------------------
INSERT INTO site_settings (
  business_name, contact_email, contact_phone, address,
  facebook_url, instagram_url, linkedin_url,
  seo_title, seo_description, currency_symbol,
  enabled_modules, chat_widget_code
) VALUES (
  'Air Fair Travel & Immigration',
  'hello@airfairtravel.ph',
  '+63 917 000 0000',
  'Marikina City, Metro Manila',
  '', '', '',
  'Air Fair Travel & Immigration | Marikina',
  'Visa filing, flight bookings, and travel planning for Filipinos heading abroad.',
  '₱',
  '{"pipeline": true, "bookings": true, "employees": true, "services": true}'::jsonb,
  ''
)
ON CONFLICT DO NOTHING;
