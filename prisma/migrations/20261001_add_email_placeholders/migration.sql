CREATE TABLE IF NOT EXISTS "EmailPlaceholderRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "label" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailPlaceholderRecord_label_key" ON "EmailPlaceholderRecord"("label");
