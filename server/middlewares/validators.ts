import { z } from 'zod';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'must be a valid id');

export const SignInSchema = z.object({
    email: z.string().email('Authentication::Email::Invalid'),
    password: z.string().min(1, 'Authentication::Password::Required')
}).strip();

export const SignUpSchema = z.object({
    username: z.string().min(8).max(16),
    fullname: z.string().min(8).max(32),
    email: z.string().email('Authentication::Email::Invalid'),
    password: z.string().min(8).max(16),
    passwordConfirm: z.string().min(8).max(16)
}).strip();

export const UpdatePasswordSchema = z.object({
    passwordCurrent: z.string().min(1),
    password: z.string().min(8).max(16),
    passwordConfirm: z.string().min(8).max(16)
}).strip();

export const CreateRepositorySchema = z.object({
    name: z.string().min(1, 'Repository::Name::Required'),
    url: z.string().min(1, 'Repository::URL::Required'),
    owner: z.string().optional(),
    alias: z.string().min(4).max(32).optional(),
    branch: z.string().optional(),
    buildCommand: z.string().optional(),
    installCommand: z.string().optional(),
    startCommand: z.string().optional(),
    rootDirectory: z.string().optional(),
    framework: z.string().optional(),
    runtime: z.string().optional(),
    runtimeVersion: z.string().optional(),
    outputDirectory: z.string().optional(),
    port: z.coerce.number().int().optional()
}).strip();

export const RepositoryOperationSchema = z.object({
    action: z.enum(['start', 'stop', 'restart'])
}).strip();

export const WebhookParamsSchema = z.object({
    repositoryId: objectId
});

export const IdParamsSchema = z.object({
    id: objectId
});

export const CreateOrganizationSchema = z.object({
    name: z.string().min(1, 'Organization::Name::Required').max(64)
}).strip();

export const CreateProjectSchema = z.object({
    name: z.string().min(1, 'Project::Name::Required').max(64)
}).strip();

export const CreateEnvironmentSchema = z.object({
    name: z.string().min(1, 'Environment::Name::Required'),
    type: z.enum(['production', 'staging', 'preview']).optional()
}).strip();

export const InviteMemberSchema = z.object({
    user: objectId,
    role: z.enum(['owner', 'admin', 'member', 'viewer'])
}).strip();

export const OrgIdParamsSchema = z.object({
    orgId: objectId
});

export const OrgMemberParamsSchema = z.object({
    orgId: objectId,
    id: objectId
});

export const ProjectIdParamsSchema = z.object({
    projectId: objectId
});

export const RepositoryIdParamsSchema = z.object({
    repositoryId: objectId
});

export const CreateHealthCheckSchema = z.object({
    type: z.enum(['http', 'tcp', 'cmd']).optional(),
    path: z.string().optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    command: z.string().optional(),
    intervalSec: z.coerce.number().int().min(5).max(3600).optional(),
    timeoutSec: z.coerce.number().int().min(1).max(120).optional(),
    healthyThreshold: z.coerce.number().int().min(1).max(20).optional(),
    unhealthyThreshold: z.coerce.number().int().min(1).max(20).optional(),
    enabled: z.boolean().optional(),
    autoRestart: z.boolean().optional(),
    gateDeploy: z.boolean().optional()
}).strip();

export const CreateDomainSchema = z.object({
    host: z.string().min(3, 'Domain::Host::Invalid'),
    tls: z.boolean().optional(),
    isPrimary: z.boolean().optional()
}).strip();

export const CreateDatabaseSchema = z.object({
    name: z.string().min(1, 'Database::Name::Required'),
    engine: z.enum(['postgres', 'mysql', 'mariadb', 'mongodb', 'redis']),
    version: z.string().optional()
}).strip();

export { objectId };

const TemplateInputSchema = z.object({
    key: z.string().min(1).max(64),
    label: z.string().min(1).max(128),
    type: z.enum(['string', 'number', 'boolean', 'secret']),
    default: z.union([z.string(), z.number(), z.boolean()]).optional(),
    required: z.boolean().optional(),
    generate: z.enum(['password', 'token']).optional()
}).strip();

export const CreateTemplateSchema = z.object({
    name: z.string().min(1, 'Template::Name::Required').max(128),
    slug: z.string().min(1).max(96).regex(/^[a-z0-9][a-z0-9-]*$/, 'Template::Slug::Invalid').optional(),
    version: z.string().min(1).max(32).optional(),
    category: z.string().min(1).max(64).optional(),
    description: z.string().max(1024).optional(),
    icon: z.string().max(512).optional(),
    website: z.string().max(512).optional(),
    spec: z.record(z.any()),
    inputsSchema: z.array(TemplateInputSchema).optional()
}).strip();

export const InstallTemplateSchema = z.object({
    template: objectId,
    name: z.string().min(1, 'TemplateInstall::Name::Required').max(128),
    version: z.string().min(1).max(32).optional(),
    environment: objectId.optional(),
    inputs: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().default({})
}).strip();
