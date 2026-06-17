ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS preferred_translation_language TEXT
    CHECK (
      preferred_translation_language IS NULL
      OR preferred_translation_language IN (
        'hindi',
        'bengali',
        'telugu',
        'marathi',
        'tamil',
        'gujarati',
        'kannada',
        'malayalam',
        'punjabi',
        'odia'
      )
    );
