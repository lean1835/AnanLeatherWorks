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
  images?: string[];
  totalAmount?: number;
}

interface UploadedRepairImage {
  objectKey: string;
  thumbnailKey: string;
  url: string;
  thumbnailUrl: string;
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
      invalidatesTags: [
        { type: "RepairOrders", id: "LIST" },
        { type: "RepairOrders", id: "TRASH" },
        { type: "Dashboard" },
      ],
    }),

    getTrashOrders: builder.query<{ success: boolean; data: RepairOrder[] }, void>({
      query: () => "/repair-orders/trash",
      providesTags: [{ type: "RepairOrders", id: "TRASH" }],
    }),

    restoreRepairOrder: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/repair-orders/${id}/restore`,
        method: "PATCH",
      }),
      invalidatesTags: [
        { type: "RepairOrders", id: "LIST" },
        { type: "RepairOrders", id: "TRASH" },
        { type: "Dashboard" },
      ],
    }),

    permanentDeleteRepairOrder: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/repair-orders/${id}/permanent`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "RepairOrders", id: "TRASH" }],
    }),

    restoreAllTrashOrders: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: "/repair-orders/trash/restore-all",
        method: "PATCH",
      }),
      invalidatesTags: [
        { type: "RepairOrders", id: "LIST" },
        { type: "RepairOrders", id: "TRASH" },
        { type: "Dashboard" },
      ],
    }),

    emptyTrash: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: "/repair-orders/trash/empty",
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "RepairOrders", id: "TRASH" }],
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
  useGetTrashOrdersQuery,
  useRestoreRepairOrderMutation,
  usePermanentDeleteRepairOrderMutation,
  useRestoreAllTrashOrdersMutation,
  useEmptyTrashMutation,
} = repairOrderApi;
