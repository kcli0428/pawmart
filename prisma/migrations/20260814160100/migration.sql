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
  ADD COLUMN "lifeStages_new" "PetLifeStage_new"[] NOT NULL DEFAULT ARRAY[]::"PetLifeStage_new"[];

UPDATE "Product"
SET "lifeStages_new" = "lifeStages_new" || ARRAY['PUPPY'::"PetLifeStage_new"]
WHERE "lifeStages" @> ARRAY['PUPPY'::"PetLifeStage"];

UPDATE "Product"
SET "lifeStages_new" = "lifeStages_new" || ARRAY['KITTEN'::"PetLifeStage_new"]
WHERE "lifeStages" @> ARRAY['KITTEN'::"PetLifeStage"];

UPDATE "Product"
SET "lifeStages_new" = "lifeStages_new" || ARRAY['ADULT_CAT'::"PetLifeStage_new"]
WHERE "lifeStages" @> ARRAY['ADULT'::"PetLifeStage"]
  AND "suitableFor" @> ARRAY['CAT'::"PetSpecies"];

UPDATE "Product"
SET "lifeStages_new" = "lifeStages_new" || ARRAY['ADULT_DOG'::"PetLifeStage_new"]
WHERE "lifeStages" @> ARRAY['ADULT'::"PetLifeStage"]
  AND (
    "suitableFor" @> ARRAY['DOG'::"PetSpecies"]
    OR NOT ("suitableFor" && ARRAY['CAT'::"PetSpecies", 'DOG'::"PetSpecies"])
  );

UPDATE "Product"
SET "lifeStages_new" = "lifeStages_new" || ARRAY['SENIOR_CAT'::"PetLifeStage_new"]
WHERE "lifeStages" @> ARRAY['SENIOR'::"PetLifeStage"]
  AND "suitableFor" @> ARRAY['CAT'::"PetSpecies"];

UPDATE "Product"
SET "lifeStages_new" = "lifeStages_new" || ARRAY['SENIOR_DOG'::"PetLifeStage_new"]
WHERE "lifeStages" @> ARRAY['SENIOR'::"PetLifeStage"]
  AND (
    "suitableFor" @> ARRAY['DOG'::"PetSpecies"]
    OR NOT ("suitableFor" && ARRAY['CAT'::"PetSpecies", 'DOG'::"PetSpecies"])
  );

ALTER TABLE "Product" DROP COLUMN "lifeStages";
ALTER TABLE "Product" RENAME COLUMN "lifeStages_new" TO "lifeStages";

DROP TYPE "PetLifeStage";
ALTER TYPE "PetLifeStage_new" RENAME TO "PetLifeStage";
