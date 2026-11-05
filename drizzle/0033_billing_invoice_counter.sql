CREATE TABLE "billing_invoice_counter" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_seq" integer NOT NULL
);
--> statement-breakpoint
INSERT INTO "billing_invoice_counter" ("year", "last_seq")
SELECT substring("number" from 5 for 4)::integer, max(substring("number" from 10)::integer)
FROM "billing_invoice"
WHERE "number" ~ '^INV-[0-9]{4}-[0-9]+$'
GROUP BY 1;
