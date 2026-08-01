import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "../configs/api";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include",
});

const baseQueryWithReformatting: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  if (typeof args !== "string" && args.params) {
    const { url, params, ...rest } = args;
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) queryParams.append(key, String(value));
    });

    const queryString = queryParams.toString().replace(/%3A/g, ":");
    const newUrl = queryString ? `${url}${url.includes("?") ? "&" : "?"}${queryString}` : url;
    return rawBaseQuery({ ...rest, url: newUrl }, api, extraOptions);
  }
  return rawBaseQuery(args, api, extraOptions);
};

const baseQueryWithSessionCleanup: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await baseQueryWithReformatting(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    sessionStorage.removeItem("accessToken");
    if (!["getMe", "login", "logout"].includes(api.endpoint)) {
      api.dispatch(baseApi.util.invalidateTags(["Auth"]));
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithSessionCleanup,
  tagTypes: ["Auth", "GlobalSetting", "LIST", "Dashboard", "RepairOrders", "Customers", "RepairTasks", "RepairImages"],
  endpoints: () => ({}),
});
