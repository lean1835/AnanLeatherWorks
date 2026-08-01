import React from "react";
import { useDispatch } from "react-redux";
import { useGetMeQuery, useLoginMutation, useLogoutMutation } from "../modules/auth/services/authApi";
import { baseApi } from "../stores/baseApi";
import { AuthContext } from "./authContext";
import { getErrorStatus } from "../utils/errorUtils";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const { data: meData, isLoading: meLoading, isError: meError, refetch: refetchMe } = useGetMeQuery();
  const [loginTrigger] = useLoginMutation();
  const [logoutTrigger] = useLogoutMutation();

  const user = meError ? null : meData?.data?.user || null;

  const login = async (username: string, password: string) => {
    const result = await loginTrigger({ username, password }).unwrap();
    if (result.data?.token) {
      localStorage.setItem("token", result.data.token);
    }
    await refetchMe().unwrap();
  };

  const logout = async () => {
    try {
      await logoutTrigger().unwrap();
    } catch (error: unknown) {
      // A 401 already means the server-side session is gone. Network/server
      // failures must keep the local authenticated state instead of pretending
      // an HttpOnly cookie was cleared.
      if (getErrorStatus(error) !== 401) throw error;
    }

    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    sessionStorage.removeItem("accessToken");
    dispatch(baseApi.util.resetApiState());
  };

  return <AuthContext.Provider value={{ user, loading: meLoading, login, logout }}>{children}</AuthContext.Provider>;
};
