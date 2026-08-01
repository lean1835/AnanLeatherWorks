import { baseApi } from "../../../stores/baseApi";
import { Customer } from "../../../types";

export const customerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCustomerByPhone: builder.query<{ success: boolean; data: Customer | null }, string>({
      query: (phone) => `/customers/by-phone/${encodeURIComponent(phone)}`,
      providesTags: (_result, _error, phone) => [{ type: "Customers", id: phone }],
    }),
    getCustomers: builder.query<{ success: boolean; data: Customer[] }, void>({
      query: () => "/customers",
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: "Customers" as const, id: _id })),
              { type: "Customers", id: "LIST" },
            ]
          : [{ type: "Customers", id: "LIST" }],
    }),
    deleteCustomer: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/customers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Customers", id: "LIST" }, { type: "RepairOrders", id: "LIST" }, { type: "Dashboard" }],
    }),
    updateCustomer: builder.mutation<{ success: boolean; data: Customer }, { id: string; body: Partial<Customer> }>({
      query: ({ id, body }) => ({
        url: `/customers/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Customers", id: id },
        { type: "Customers", id: "LIST" },
        { type: "RepairOrders", id: "LIST" },
        { type: "Dashboard" },
      ],
    }),
    createCustomer: builder.mutation<{ success: boolean; data: Customer }, Partial<Customer>>({
      query: (body) => ({
        url: "/customers",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Customers", id: "LIST" }, { type: "RepairOrders", id: "LIST" }, { type: "Dashboard" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCustomerByPhoneQuery,
  useLazyGetCustomerByPhoneQuery,
  useGetCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
  useCreateCustomerMutation,
} = customerApi;
