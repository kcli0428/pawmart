INSERT INTO "Category" ("id", "name", "slug", "description")
SELECT 'cat_dry_food_001', '貓乾糧', 'cat-dry-food', '貓用乾糧、風乾糧'
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'cat-dry-food');

INSERT INTO "Category" ("id", "name", "slug", "description")
SELECT 'cat_wet_food_001', '貓濕糧', 'cat-wet-food', '貓用罐頭、慕絲、湯包'
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'cat-wet-food');

INSERT INTO "Category" ("id", "name", "slug", "description")
SELECT 'dog_dry_food_001', '狗乾糧', 'dog-dry-food', '狗用乾糧、風乾糧'
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'dog-dry-food');

INSERT INTO "Category" ("id", "name", "slug", "description")
SELECT 'dog_wet_food_001', '狗濕糧', 'dog-wet-food', '狗用罐頭、濕糧'
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'dog-wet-food');

UPDATE "Product"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "slug" = 'cat-wet-food' LIMIT 1)
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "slug" = 'cat-food')
  AND ("name" ~ '罐|濕|慕絲|肉泥' OR coalesce("description", '') ~ '罐|濕|慕絲|肉泥');

UPDATE "Product"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "slug" = 'cat-dry-food' LIMIT 1)
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "slug" = 'cat-food');

UPDATE "Product"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "slug" = 'dog-wet-food' LIMIT 1)
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "slug" = 'dog-food')
  AND ("name" ~ '罐|濕|慕絲|肉泥' OR coalesce("description", '') ~ '罐|濕|慕絲|肉泥');

UPDATE "Product"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "slug" = 'dog-dry-food' LIMIT 1)
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "slug" = 'dog-food');

DELETE FROM "Category"
WHERE "slug" IN ('cat-food', 'dog-food')
  AND NOT EXISTS (
    SELECT 1 FROM "Product" WHERE "Product"."categoryId" = "Category"."id"
  );
