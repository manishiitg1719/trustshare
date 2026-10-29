-- SHARED CONTRACT. Applied by `npm run db:setup` after `prisma db push`.
-- Statements are separated by lines containing only "-- ;".
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- ;
-- No two live bookings of the same resource may overlap. Enforced by the database, not only the UI.
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_no_overlap;
-- ;
ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist ("resourceId" WITH =, tsrange("start", "end") WITH &&)
  WHERE (status IN ('APPROVED', 'CHECKED_IN', 'OVERDUE'));
-- ;
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_end_after_start;
-- ;
ALTER TABLE "Booking" ADD CONSTRAINT booking_end_after_start CHECK ("end" > "start");
-- ;
-- The audit log is append-only.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;
-- ;
DROP TRIGGER IF EXISTS audit_log_no_change ON "AuditLog";
-- ;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
