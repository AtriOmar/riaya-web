import api from "./api";
import type { Person, PersonSource } from "./types";

export interface UpdatePersonInput {
	firstName?: string;
	lastName?: string;
	dateOfBirth?: string;
	gender?: string;
	address?: string;
}

export async function upsertPerson(
	phoneNumber: string,
	source: PersonSource = "call",
): Promise<Person> {
	const { data } = await api.post<Person>("/api/persons", {
		phoneNumber,
		source,
	});
	return data;
}

export async function updatePerson(
	id: number,
	data: UpdatePersonInput,
): Promise<Person> {
	const { data: res } = await api.patch<Person>(`/api/persons/${id}`, data);
	return res;
}
