import api from "@/services/api";

export const fetcher = <T>(url: string) =>
	api.get<T>(url).then((res) => res.data);
