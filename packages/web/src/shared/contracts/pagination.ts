export interface PageQuery{
    limit: number;
    offset: number;
}

export interface PageNavigation{
    page: number;
    pageCount: number;
    from: number;
    to: number;
    hasPrevious: boolean;
    hasNext: boolean;
}
