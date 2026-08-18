import { Document, Model, PopulateOptions } from 'mongoose';

export interface RequestQueryString {
    search?: string;
    page?: string;
    sort?: string;
    limit?: string;
    fields?: string;
    populate?: string | PopulateOptions;
    [key: string]: any;
}

export interface Buffer {
    find: Record<string, any>;
    sort: Record<string, any> | string;
    select: string;
    skip: number;
    limit: number;
    totalResults: number;
    skippedResults: number;
    page: number;
    totalPages: number;
}

export interface Options {
    requestQueryString: RequestQueryString;
    model: Model<Document>;
    fields: string[];
    populate?: string | PopulateOptions | (string | PopulateOptions)[] | null;
}
