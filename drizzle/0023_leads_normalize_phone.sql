-- Normalize stored lead phone numbers to last 10 digits for consistent deduplication.
UPDATE leads
SET
    phone = RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10),
    updated_at = NOW()
WHERE LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10;

UPDATE leads
SET
    phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g'),
    updated_at = NOW()
WHERE LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) < 10;
