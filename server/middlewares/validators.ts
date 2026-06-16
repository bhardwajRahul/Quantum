/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place.
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

import { z } from 'zod';

/**
 * Central request-validation schemas, consumed by the reusable `validate`
 * middleware (@middlewares/validation). Keeping them in one place keeps the
 * route files thin and gives a single source of truth for request shapes.
 *
 * Convention: schemas are permissive about EXTRA keys only where a controller
 * intentionally filters fields itself (HandlerFactory `fields`), and strict on
 * the security-sensitive boundaries (auth, webhook).
 */

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'must be a valid id');

/* ----------------------------- Authentication ----------------------------- */

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

/* -------------------------------- Repository ------------------------------- */

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

/* ---------------------------------- Webhook -------------------------------- */

// GitHub push webhook: we only need to recognize a real push (has `pusher`).
// Signature is verified separately via HMAC; this guards the SHAPE before any
// Docker/git side effect runs. We accept the large GitHub payload but validate
// the minimum we depend on, and pass through the rest.
export const WebhookParamsSchema = z.object({
    repositoryId: objectId
});

/* ------------------------------- Shared params ----------------------------- */

export const IdParamsSchema = z.object({
    id: objectId
});

/* -------------------------------- API tokens ------------------------------- */

// Personal access tokens (Bearer auth). The raw token is generated server-side
// and returned only once; the client supplies a human label, optional scopes,
// and an optional expiry.
export const CreateTokenSchema = z.object({
    name: z.string().min(1).max(64),
    scopes: z.array(z.string()).optional(),
    expiresAt: z.coerce.date().optional()
}).strip();

/* -------------------------------- Tenancy ---------------------------------- */

// Org/Project slugs are derived server-side from the name (never user-supplied),
// so these create schemas only accept a human-friendly name and strip the rest.
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

// `user` is the id of an EXISTING user being granted a role in the org; the
// organization itself is stamped from the resolved tenant context, never the body.
export const InviteMemberSchema = z.object({
    user: objectId,
    role: z.enum(['owner', 'admin', 'member', 'viewer'])
}).strip();

// Tenant route params. Kept separate from IdParamsSchema so the resolveTenant
// middleware can key off the conventional :orgId / :projectId names.
export const OrgIdParamsSchema = z.object({
    orgId: objectId
});

// Member mutation routes carry BOTH :orgId and the member's :id. Validating with
// OrgIdParamsSchema alone stripped req.params.id (it only declares orgId), leaving
// the controller unable to identify the membership — so the owner-protection guard
// in removeMember silently no-op'd. Keep both.
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

/* ------------------------------ Observability ------------------------------ */

// A health probe definition. `repository` is taken from the route param (verified
// owner), so the body only carries probe config; thresholds/intervals default in
// the model when omitted.
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

// An alert delivery destination. `secret` (webhook HMAC signing key) is encrypted
// at rest by the controller and never returned; the project comes from the route.
export const CreateAlertChannelSchema = z.object({
    type: z.enum(['email', 'webhook']),
    config: z.object({
        email: z.string().email().optional(),
        url: z.string().url().optional()
    }).strip().optional().default({}),
    secret: z.string().optional(),
    enabled: z.boolean().optional()
}).strip();

// Binds an event (optionally above a numeric threshold) to a channel in the same
// project. `repository` optionally narrows the rule to one repo.
export const CreateAlertRuleSchema = z.object({
    event: z.enum(['deployment.failed', 'health.unhealthy', 'container.crashed', 'metrics.cpu', 'metrics.mem']),
    threshold: z.coerce.number().optional(),
    channel: objectId,
    repository: objectId.optional(),
    enabled: z.boolean().optional()
}).strip();

/* --------------------------------- Ingress -------------------------------- */

// A routable hostname bound to a repository. `host` is the only required field;
// the controller stamps project/user/repository from the verified route param and
// derives isPrimary when omitted. tls/isPrimary are optional overrides.
export const CreateDomainSchema = z.object({
    host: z.string().min(3, 'Domain::Host::Invalid'),
    tls: z.boolean().optional(),
    isPrimary: z.boolean().optional()
}).strip();

/* ---------------------------- Managed databases --------------------------- */

// Create a managed database under a project. The engine is constrained to the
// first-class set; `version` is an optional image tag (defaulted from the engine
// registry server-side when omitted). Credentials are generated server-side and
// never accepted from the client.
export const CreateDatabaseSchema = z.object({
    name: z.string().min(1, 'Database::Name::Required'),
    engine: z.enum(['postgres', 'mysql', 'mariadb', 'mongodb', 'redis']),
    version: z.string().optional()
}).strip();

export { objectId };

/* ---------------------------- Templates marketplace ----------------------------- */

// One declared input field of a custom template. `key` is referenced as
// ${input.KEY} in the spec; secret/generate values are encrypted + stripped.
const TemplateInputSchema = z.object({
    key: z.string().min(1).max(64),
    label: z.string().min(1).max(128),
    type: z.enum(['string', 'number', 'boolean', 'secret']),
    default: z.union([z.string(), z.number(), z.boolean()]).optional(),
    required: z.boolean().optional(),
    generate: z.enum(['password', 'token']).optional()
}).strip();

// Publish a custom template. `spec` is the raw docker-compose-subset OR legacy
// one-click document; the controller runs it through compose.parseCompose (which
// applies the security allowlist) before persisting the normalized TemplateSpec.
// The organization/source/version-latest bookkeeping is stamped server-side.
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

// Install a template into :projectId. `inputs` is a free-form key/value map keyed
// by the template's inputsSchema; the controller validates it against the pinned
// schema, generates+encrypts secret inputs, and stamps tenant context. `version`
// optionally pins a non-latest version; `environment` optionally targets an env.
export const InstallTemplateSchema = z.object({
    template: objectId,
    name: z.string().min(1, 'TemplateInstall::Name::Required').max(128),
    version: z.string().min(1).max(32).optional(),
    environment: objectId.optional(),
    inputs: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().default({})
}).strip();

