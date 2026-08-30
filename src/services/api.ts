import axios, { type AxiosRequestConfig } from "axios";

/**
 * Shared axios instance used by all services.
 * On non-2xx responses axios throws an AxiosError whose `.response.data`
 * contains the JSON error body returned by the API.
 */
const api = axios.create();

export const customInstance = <T>(
	config: AxiosRequestConfig,
	options?: AxiosRequestConfig,
): Promise<T> => {
	const promise = api({
		...config,
		...options,
	}).then(({ data }) => data);

	return promise;
};

export default api;
