// Dev helper: deletes a user by email together with everything that depends on
// them (doctor profile, patients, appointments, invoices, ...). Refuses to run
// against a non-local database.
//
// Usage: pnpm db:delete-user contact6@omaratri.com

import { Pool, type PoolClient } from "pg";

const email = process.argv[2];
if (!email) {
	console.error("Usage: pnpm db:delete-user <email>");
	process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}
const { hostname } = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
	console.error(`Refusing to delete from non-local database (${hostname})`);
	process.exit(1);
}

type Reference = { table: string; column: string; onDelete: string };

// Foreign keys pointing at `table`. Set-null references ("n") are left to the database.
async function referencesTo(client: PoolClient, table: string) {
	const { rows } = await client.query<Reference>(
		`select c.conrelid::regclass::text as table, a.attname as column, c.confdeltype as "onDelete"
		 from pg_constraint c
		 join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
		 where c.contype = 'f' and c.confrelid = $1::regclass and c.confdeltype <> 'n'`,
		[table],
	);
	return rows;
}

async function hasIdColumn(client: PoolClient, table: string) {
	const { rowCount } = await client.query(
		`select 1 from pg_attribute where attrelid = $1::regclass and attname = 'id' and not attisdropped`,
		[table],
	);
	return rowCount === 1;
}

// Deletes the given rows after deleting every row that references them.
async function deleteRows(
	client: PoolClient,
	table: string,
	ids: (string | number)[],
	log: Map<string, number>,
) {
	if (ids.length === 0) return;
	for (const ref of await referencesTo(client, table)) {
		const select = (await hasIdColumn(client, ref.table))
			? await client.query<{ id: string | number }>(
					`select id from ${ref.table} where "${ref.column}" = any($1)`,
					[ids],
				)
			: null;
		if (select) {
			await deleteRows(
				client,
				ref.table,
				select.rows.map((r) => r.id),
				log,
			);
		} else {
			const res = await client.query(
				`delete from ${ref.table} where "${ref.column}" = any($1)`,
				[ids],
			);
			log.set(ref.table, (log.get(ref.table) ?? 0) + (res.rowCount ?? 0));
		}
	}
	const res = await client.query(`delete from ${table} where id = any($1)`, [
		ids,
	]);
	log.set(table, (log.get(table) ?? 0) + (res.rowCount ?? 0));
}

async function main() {
	const pool = new Pool({ connectionString: databaseUrl });
	const client = await pool.connect();
	try {
		await client.query("begin");
		const { rows } = await client.query<{ id: string }>(
			`select id from "user" where email = $1`,
			[email],
		);
		if (rows.length === 0) {
			console.log(`No user with email ${email}`);
		} else {
			const log = new Map<string, number>();
			await deleteRows(client, '"user"', [rows[0].id], log);
			const res = await client.query(
				`delete from verification where identifier ilike $1`,
				[`%${email}%`],
			);
			log.set("verification", res.rowCount ?? 0);
			for (const [table, count] of log) {
				if (count > 0) console.log(`${table}: ${count}`);
			}
		}
		await client.query("commit");
	} catch (e) {
		await client.query("rollback");
		console.error("Rolled back, nothing deleted:", e);
		process.exitCode = 1;
	} finally {
		client.release();
		await pool.end();
	}
}

main();
