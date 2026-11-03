-- Approving an application used to leave the medical council number and
-- certificate off the doctor profile. Copy them from the latest verified one.
UPDATE "doctor_profile" AS d
SET
	"medical_council_number" = COALESCE(d."medical_council_number", a."medical_council_number"),
	"medical_council_certificate" = COALESCE(d."medical_council_certificate", a."medical_council_certificate")
FROM (
	SELECT DISTINCT ON ("user_id") "user_id", "medical_council_number", "medical_council_certificate"
	FROM "doctor_application"
	WHERE "status" = 'verified'
	ORDER BY "user_id", "updated_at" DESC
) AS a
WHERE a."user_id" = d."user_id"
	AND (d."medical_council_number" IS NULL OR d."medical_council_certificate" IS NULL);
