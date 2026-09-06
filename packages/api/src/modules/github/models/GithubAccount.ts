import { Column, Entity } from 'typeorm';
import BaseModel from '@/shared/models/BaseModel';
import { Hidden } from '@/shared/models/Hidden';
import type { GithubAccountFields } from '../contracts/domain/github';

@Entity()
export default class GithubAccount extends BaseModel implements GithubAccountFields{
    @Column({ type: 'int', unique: true })
    userId!: number;

    @Column('varchar')
    githubId!: string;

    @Column('varchar')
    @Hidden()
    accessToken!: string;

    @Column('varchar')
    username!: string;

    @Column({ type: 'varchar', nullable: true })
    avatarUrl!: string | null;
}
