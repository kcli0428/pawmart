CREATE TYPE "PetLifeStage_new" AS ENUM (
  'PUPPY',
  'KITTEN',
  'ADULT_DOG',
  'ADULT_CAT',
  'SENIOR_DOG',
  'SENIOR_CAT'
);

ALTER TABLE "Pet"
  ALTER COLUMN "lifeStage" TYPE "PetLifeStage_new"
  USING (
    CASE
      WHEN "lifeStage"::text = 'PUPPY' THEN 'PUPPY'::"PetLifeStage_new"
      WHEN "lifeStage"::text = 'KITTEN' THEN 'KITTEN'::"PetLifeStage_new"
      WHEN "lifeStage"::text = 'ADULT' AND "species" = 'CAT' THEN 'ADULT_CAT'::"PetLifeStage_new"
      WHEN "lifeStage"::text = 'ADULT' THEN 'ADULT_DOG'::"PetLifeStage_new"
      WHEN "lifeStage"::text = 'SENIOR' AND "species" = 'CAT' THEN 'SENIOR_CAT'::"PetLifeStage_new"
      WHEN "lifeStage"::text = 'SENIOR' THEN 'SENIOR_DOG'::"PetLifeStage_new"
      ELSE NULL
    END
  );

ALTER TABLE "Product"
  ALTER COLUMN "lifeStages" TYPE "PetLifeStage_new"[]
  USING (
    COALESCE((
      SELECT ARRAY_AGG(DISTINCT mapped ORDER BY mapped)
      FROM (
        SELECT
          CASE
            WHEN stage::text = 'PUPPY' THEN 'PUPPY'::"PetLifeStage_new"
            WHEN stage::text = 'KITTEN' THEN 'KITTEN'::"PetLifeStage_new"
            WHEN stage::text = 'ADULT' AND "suitableFor" @> ARRAY['CAT'::"PetSpecies"] THEN 'ADULT_CAT'::"PetLifeStage_new"
            WHEN stage::text = 'SENIOR' AND "suitableFor" @> ARRAY['CAT'::"PetSpecies"] THEN 'SENIOR_CAT'::"PetLifeStage_new"
            ELSE NULL
          END AS mapped
        FROM unnest("lifeStages") AS stage
        UNION ALL
        SELECT
          CASE
            WHEN stage::text = 'ADULT' AND (
              "suitableFor" @> ARRAY['DOG'::"PetSpecies"]
              OR NOT ("suitableFor" && ARRAY['CAT'::"PetSpecies", 'DOG'::"PetSpecies"])
            ) THEN 'ADULT_DOG'::"PetLifeStage_new"
            WHEN stage::text = 'SENIOR' AND (
              "suitableFor" @> ARRAY['DOG'::"PetSpecies"]
              OR NOT ("suitableFor" && ARRAY['CAT'::"PetSpecies", 'DOG'::"PetSpecies"])
            ) THEN 'SENIOR_DOG'::"PetLifeStage_new"
            ELSE NULL
          END
        FROM unnest("lifeStages") AS stage
      ) mapped_stages
      WHERE mapped IS NOT NULL
    ), ARRAY[]::"PetLifeStage_new"[])
  );

DROP TYPE "PetLifeStage";
ALTER TYPE "PetLifeStage_new" RENAME TO "PetLifeStage";
