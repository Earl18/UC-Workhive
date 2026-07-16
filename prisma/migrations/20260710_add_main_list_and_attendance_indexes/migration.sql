CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "EmployeeRecord_sequence_idx"
  ON "EmployeeRecord" ("sequence");

CREATE INDEX IF NOT EXISTS "EmployeeRecord_department_sequence_idx"
  ON "EmployeeRecord" ("department", "sequence");

CREATE INDEX IF NOT EXISTS "EmployeeRecord_employmentStatus_sequence_idx"
  ON "EmployeeRecord" ("employmentStatus", "sequence");

CREATE INDEX IF NOT EXISTS "EmployeeRecord_gender_sequence_idx"
  ON "EmployeeRecord" ("gender", "sequence");

CREATE INDEX IF NOT EXISTS "EmployeeRecord_master_search_trgm_idx"
  ON "EmployeeRecord"
  USING GIN ((concat_ws(' ', "lastName", "firstName", "middleName", "department", "position", "email")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "EmployeeRecord_position_normalized_idx"
  ON "EmployeeRecord" ((regexp_replace("position", '\\s*\\([^)]*\\)', '', 'g')));

CREATE INDEX IF NOT EXISTS "EmployeeRecord_full_name_lookup_idx"
  ON "EmployeeRecord" ((LOWER(REGEXP_REPLACE(TRIM(COALESCE("lastName", '') || '|' || COALESCE("firstName", '') || '|' || COALESCE("middleName", '')), '\\s+', ' ', 'g'))));

CREATE INDEX IF NOT EXISTS "AttendanceLog_staffCategory_monthKey_workDate_idx"
  ON "AttendanceLog" ("staffCategory", "monthKey", "workDate");

CREATE INDEX IF NOT EXISTS "AttendanceLog_staffCategory_employeeId_workDate_idx"
  ON "AttendanceLog" ("staffCategory", "employeeId", "workDate");

CREATE INDEX IF NOT EXISTS "AttendanceLog_staffCategory_remarks_workDate_idx"
  ON "AttendanceLog" ("staffCategory", "remarks", "workDate");

CREATE INDEX IF NOT EXISTS "AttendanceLog_staffCategory_overtimeStatus_workDate_idx"
  ON "AttendanceLog" ("staffCategory", "overtimeStatus", "workDate");

CREATE INDEX IF NOT EXISTS "AttendanceLog_staffCategory_requiresValidation_validationStatus_workDate_idx"
  ON "AttendanceLog" ("staffCategory", "requiresValidation", "validationStatus", "workDate");

