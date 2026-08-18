import { Document, Model, PopulateOptions } from 'mongoose';
import { filterObject } from '@utilities/helpers';
import { RequestQueryString, Buffer, Options } from '@typings/utilities/apiFeatures';
import RuntimeError from '@utilities/runtimeError';

class APIFeatures{
    private model: Model<Document>;
    private requestQueryString: RequestQueryString;
    private populate: string | PopulateOptions | (string | PopulateOptions)[] | null;
    private fields: string[];
    private buffer: Buffer;

    constructor({ requestQueryString, model, fields = [], populate = null }: Options) {
        this.model = model;
        this.requestQueryString = requestQueryString;
        this.fields = fields;
        this.populate = populate;
        this.buffer = {
            find: {},
            sort: {},
            select: '',
            skip: 0,
            limit: 100,
            totalResults: 0,
            skippedResults: 0,
            page: 1,
            totalPages: 1
        };
    }

    async perform(): Promise<{
        records: Document[];
        totalResults: number;
        skippedResults: number;
        page: number;
        limit: number;
        totalPages: number;
    }>{
        const { find, sort, select, skip, limit } = this.buffer;
        let query = this.model.find(find).skip(skip).limit(limit).select(select).sort(sort);
        if(this.populate){
            if(Array.isArray(this.populate)){
                this.populate.forEach((pop) => {
                    query = query.populate(pop as string);
                });
            }else{
                query = query.populate(this.populate as PopulateOptions);
            }
        }
        const records = await query;
        return {
            records,
            totalResults: this.buffer.totalResults,
            skippedResults: this.buffer.skippedResults,
            page: this.buffer.page,
            limit: this.buffer.limit,
            totalPages: this.buffer.totalPages
        };
    }

    search(): APIFeatures{
        const { q } = this.requestQueryString;
        if(q){
            const escapedTerm = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            this.buffer.find.$text = { $search: escapedTerm };
            this.buffer.sort = { score: { $meta: 'textScore' }, ...(this.buffer.sort as object) };
            this.buffer.select += ' score';
        }
        return this;
    }

     filter(auxFilter: any = {}): APIFeatures{
        const excludedFields = ['page', 'sort', 'limit', 'fields', 'populate'];
        const query = Object.keys(this.requestQueryString)
            .filter(key => !excludedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = this.requestQueryString[key];
                return obj;
            }, {} as Record<string, any>);

        const filter = filterObject(query, ...this.fields);
        Object.assign(this.buffer.find, { ...filter, ...auxFilter });
        return this;
    }

    sort(): APIFeatures{
        const { sort: sortQuery } = this.requestQueryString;
        if(sortQuery){
            const sortBy = sortQuery.split(',').join(' ');
            if(typeof this.buffer.sort === 'object' && !Array.isArray(this.buffer.sort)){
                const sortFields = sortBy.split(' ');
                sortFields.forEach((field) => {
                    const order = field.startsWith('-') ? -1 : 1;
                    const fieldName = field.startsWith('-') ? field.substring(1) : field;
                    (this.buffer.sort as Record<string, any>)[fieldName] = order;
                });
            }else{
                this.buffer.sort = sortBy;
            }
        }else{
            this.buffer.sort = '-createdAt';
        }
        return this;
    }

    limitFields(): APIFeatures{
        const { fields } = this.requestQueryString;
        if(fields){
            this.buffer.select = fields.split(',').join(' ');
        }
        return this;
    }

    async paginate(): Promise<APIFeatures>{
        const limit = this.requestQueryString.limit ? parseInt(this.requestQueryString.limit, 10) : this.buffer.limit;
        if(limit !== -1){
            const page = this.requestQueryString.page ? Math.max(1, parseInt(this.requestQueryString.page, 10)) : 1;
            const skip = (page - 1) * limit;
            this.buffer.skip = skip;
            this.buffer.limit = limit;
            this.buffer.page = page;
            this.buffer.skippedResults = skip;
            const totalResults = await this.model.countDocuments(this.buffer.find).exec();
            this.buffer.totalResults = totalResults;
            this.buffer.totalPages = Math.ceil(totalResults / limit) || 1;
            if(this.requestQueryString.page && skip >= totalResults){
                throw new RuntimeError('Core::PageOutOfRange', 404);
            }
        }
        return this;
    }
}

export default APIFeatures;