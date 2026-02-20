import { NextResponse } from 'next/server';

export type ApiErrorCode =
    | 'VALIDATION_ERROR'
    | 'AUTH_REQUIRED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'INTERNAL_ERROR';

export type ApiSuccess<T> = {
    data: T;
    success?: true;
};

export type ApiFailure = {
    error: string;
    success?: false;
    code: ApiErrorCode;
    message: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, status = 200) {
    return NextResponse.json<ApiSuccess<T>>({ data, success: true }, { status });
}

export function fail(status: number, code: ApiErrorCode, message: string) {
    return NextResponse.json<ApiFailure>({ error: message, code, message }, { status });
}
