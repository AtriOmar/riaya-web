import axios from "axios";

/**
 * Shared axios instance used by all services.
 * On non-2xx responses axios throws an AxiosError whose `.response.data`
 * contains the JSON error body returned by the API.
 */
const api = axios.create();

export default api;
