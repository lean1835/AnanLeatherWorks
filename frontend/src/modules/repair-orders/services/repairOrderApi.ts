import { baseApi } from "../../../stores/baseApi";
import { CustomerGroupItem, OrderStatus, RepairOrder } from "../../../types";

interface CreateRepairOrderPayload {
  phone: string;
  fullName: string;
  customerNote?: string;
  productName: string;
  receivedAt: string;
  dueAt: string;
  note?: string;
  status?: OrderStatus;
  replacementMaterials?: string[];
  tasks?: string[];
  beforeImages?: string[];
  afterImages?: string[];
  totalAmount?: number;
}

interface UploadedRepairImage {
  objectKey: string;
  thumbnailKey: string;
  url: string;
  thumbnailUrl: string;
  stage: "before" | "after";
}

export const repairOrderApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createRepairOrder: builder.mutation<
      { success: boolean; message: string; data: { id: string } },
      CreateRepairOrderPayload
    >({
      query: (body) => ({
        url: "/repair-orders",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "RepairOrders", id: "LIST" }, { type: "Dashboard" }],
    }),

    uploadRepairImage: builder.mutation<
      { success: boolean; message: string; data: UploadedRepairImage },
      { formData: FormData; repairOrderId?: string }
    >({
      query: ({ formData }) => ({
        url: "/repair-orders/upload-image",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: [],
    }),

    downloadCustomerRepairPdf: builder.mutation<Blob, { customerId: string; month?: number; year?: number }>({
      query: ({ customerId, month, year }) => ({
        url: `/repair-orders/customer/${encodeURIComponent(customerId)}/pdf`,
        method: "GET",
        params: { month, year, t: Date.now() },
        cache: "no-store",
        responseHandler: (response) => response.blob(),
      }),
    }),

    deleteUnreferencedRepairImage: builder.mutation<{ success: boolean; message: string }, string>({
      query: (objectKey) => ({
        url: `/repair-orders/images/${encodeURIComponent(objectKey)}`,
        method: "DELETE",
      }),
    }),

    getOrdersByCustomerGroup: builder.query<
      {
        success: boolean;
        data: {
          month?: number;
          year?: number;
          customers: CustomerGroupItem[];
        };
      },
      { month?: number; year?: number; search?: string; customerId?: string }
    >({
      query: (params) => ({
        url: "/repair-orders/customer-group",
        params: {
          month: params.month,
          year: params.year,
          search: params.search || "",
          customerId: params.customerId,
        },
      }),
      providesTags: [{ type: "RepairOrders", id: "LIST" }],
    }),

    updateRepairOrder: builder.mutation<
      { success: boolean; message: string; data: RepairOrder },
      { id: string; body: Partial<RepairOrder> }
    >({
      query: ({ id, body }) => ({
        url: `/repair-orders/${id}`,
        method: "PATCH",
        body,
      }),
      // The detail page updates its exact RTK Query cache optimistically. Avoid
      // refetching the full customer group after every spreadsheet cell edit.
      invalidatesTags: [{ type: "Dashboard" }],
    }),

    deleteRepairOrder: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/repair-orders/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "RepairOrders", id: "LIST" }, { type: "Dashboard" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useCreateRepairOrderMutation,
  useUploadRepairImageMutation,
  useDownloadCustomerRepairPdfMutation,
  useDeleteUnreferencedRepairImageMutation,
  useGetOrdersByCustomerGroupQuery,
  useUpdateRepairOrderMutation,
  useDeleteRepairOrderMutation,
} = repairOrderApi;
