import { Entity, Column, Index } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { Hidden } from '@/shared/models/Hidden';
import { RegistryCredentialFields } from '../contracts/domain/registry';

@Entity()
@Index(['organizationId', 'registry'], { unique: true })
export default class RegistryCredential extends BaseModel implements RegistryCredentialFields{
    @Column('int')
    organizationId!: number;

    @Column('varchar')
    registry!: string;

    @Column('varchar')
    username!: string;

    @Hidden()
    @Column('varchar')
    secretEnc!: string;
}
