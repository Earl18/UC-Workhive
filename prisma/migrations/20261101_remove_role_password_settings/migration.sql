ALTER TABLE "SystemSettings"
  DROP COLUMN IF EXISTS "employeeDefaultPassword",
  DROP COLUMN IF EXISTS "hrDefaultPassword",
  DROP COLUMN IF EXISTS "adminDefaultPassword",
  DROP COLUMN IF EXISTS "employeePasswordVersion",
  DROP COLUMN IF EXISTS "hrPasswordVersion",
  DROP COLUMN IF EXISTS "adminPasswordVersion";
