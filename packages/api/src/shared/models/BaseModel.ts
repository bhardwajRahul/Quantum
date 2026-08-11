import { BaseEntity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { getHiddenFields } from './Hidden';

export default abstract class BaseModel extends BaseEntity{
    @PrimaryGeneratedColumn()
    id!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    toJSON(): Record<string, unknown>{
        const hidden = getHiddenFields(this.constructor);
        const output: Record<string, unknown> = {};
        for(const [key, value] of Object.entries(this)){
            if(!hidden.has(key)) output[key] = value;
        }
        return output;
    }
}
