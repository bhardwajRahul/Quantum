import type { InputDef, TemplateSpec } from './domain';

export interface CreateTemplateInput{
    /**
     * @minLength 1
     * @maxLength 128
     */
    name: string;
    /**
     * @minLength 1
     * @maxLength 96
     * @pattern ^[a-z0-9][a-z0-9-]*$
     */
    slug?: string;
    /**
     * @minLength 1
     * @maxLength 32
     */
    version?: string;
    /**
     * @minLength 1
     * @maxLength 64
     */
    category?: string;
    /** @maxLength 1024 */
    description?: string;
    /** @maxLength 512 */
    icon?: string;
    /** @maxLength 512 */
    website?: string;
    spec: TemplateSpec;
    inputsSchema?: InputDef[];
}

export interface InstallTemplateInput{
    /**
     * @type uint
     * @minimum 1
     */
    templateId: number;
    /**
     * @minLength 1
     * @maxLength 128
     */
    name: string;
    /**
     * @type uint
     * @minimum 1
     */
    environmentId?: number | null;
    inputs?: Record<string, string | number | boolean>;
}

export interface TemplateListQuery{
    category?: string;
}
