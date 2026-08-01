import { baseApi } from "../../../stores/baseApi";
import { DashboardData } from "../../../types";

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<{ success: boolean; data: DashboardData }, void>({
      query: () => "/repair-orders/dashboard-stats",
      providesTags: ["Dashboard"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetDashboardStatsQuery } = dashboardApi;
