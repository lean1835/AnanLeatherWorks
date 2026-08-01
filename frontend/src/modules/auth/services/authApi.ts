import { baseApi } from "../../../stores/baseApi";
import { User } from "../../../types";

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<{ success: boolean; data: { user: User } }, void>({
      query: () => "/auth/me",
      providesTags: ["Auth"],
    }),
    login: builder.mutation<
      { success: boolean; message: string; data: { user: User } },
      { username: string; password: string }
    >({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    logout: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useGetMeQuery, useLoginMutation, useLogoutMutation } = authApi;
