export interface IApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    status?: number;
}

export interface IPaginatedMeta {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
}

export interface IPaginatedResponse<T = unknown> {
    success: boolean;
    message?: string;
    data: T[];
    meta: IPaginatedMeta;
}
