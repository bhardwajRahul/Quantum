export type { ITemplateInstall } from '@models/templateInstall';

export type TemplateInstallStatus =
    | 'pending'
    | 'installing'
    | 'running'
    | 'failed'
    | 'removed';

export interface ITemplateInstallService{
    name: string;
    container?: import('mongoose').Types.ObjectId;
    role: string;
}
