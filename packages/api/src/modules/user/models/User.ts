import { Entity, Column } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { Hidden } from '@/shared/models/Hidden';
import { UserRole } from '@quantum/contracts/modules/user/domain';
import { UserFields } from '../contracts/domain/user';

@Entity()
export default class User extends BaseModel implements UserFields{
    @Column({ type: 'varchar', unique: true })
    username!: string;

    @Column('varchar')
    fullname!: string;

    @Column({ type: 'varchar', unique: true })
    email!: string;

    @Column({ type: 'simple-enum', enum: UserRole, default: UserRole.User })
    role!: UserRole;

    @Column('varchar')
    @Hidden()
    passwordHash!: string;

    @Column({ type: 'timestamp', nullable: true })
    @Hidden()
    passwordChangedAt!: Date | null;

    @Column({ type: 'int', nullable: true })
    defaultOrganizationId!: number | null;
}
