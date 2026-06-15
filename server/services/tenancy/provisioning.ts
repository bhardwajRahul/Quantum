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

import mongoose from 'mongoose';
import { v4 } from 'uuid';
import Organization from '@models/organization';
import Membership from '@models/membership';
import Project from '@models/project';
import Environment from '@models/environment';
import DockerContainer from '@models/docker/container';
import DockerImage from '@models/docker/image';
import DockerNetwork from '@models/docker/network';
import logger from '@utilities/logger';
import { IUser } from '@typings/models/user';
import { IOrganization } from '@typings/models/organization';
import { IProject } from '@typings/models/project';
import { IEnvironment } from '@typings/models/environment';
import { IMembership } from '@typings/models/membership';
import { IDockerContainer } from '@typings/models/docker/container';

interface TenancyResult{
    organization: IOrganization;
    project: IProject;
    environment: IEnvironment;
    membership: IMembership;
}

/**
 * Turn an arbitrary string into a URL/DB-friendly slug. Lowercases, strips
 * non-alphanumeric runs to single dashes and trims leading/trailing dashes.
 */
const slugify = (value: string): string => {
    return value
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

/**
 * Produce a slug that does not collide with an existing Organization. If the
 * base slug is taken, append a short uuid suffix (same pattern as the repository
 * alias de-duplication) until a free slug is found.
 */
const ensureUniqueOrgSlug = async (base: string): Promise<string> => {
    let candidate = base || 'org';
    // Loop is bounded in practice: a 4-char uuid slice collision twice is
    // astronomically unlikely, but we cap iterations to stay safe.
    for(let attempt = 0; attempt < 5; attempt++){
        const existing = await Organization.findOne({ slug: candidate }).lean();
        if(!existing) return candidate;
        candidate = `${base}-${v4().slice(0, 4)}`;
    }
    return `${base}-${v4().slice(0, 8)}`;
};

/**
 * Idempotently ensure an organization has its default Project + production
 * Environment. Resolve-or-create, so it is safe to call on every org creation
 * (existing defaults are returned, never duplicated). This is the per-org slice
 * of tenancy, independent of any "personal org" notion — it is the single
 * source of truth for "a usable org has a default project and environment",
 * shared by createOrganization (UI path) and ensureDefaultTenancy (legacy path).
 *
 * @param organizationId - the org to provision defaults under.
 */
export const ensureOrgDefaults = async (
    organizationId: mongoose.Types.ObjectId | string
): Promise<{ project: IProject; environment: IEnvironment }> => {
    // Project (default).
    let project = await Project.findOne({ organization: organizationId, slug: 'default' })
        ?? await Project.findOne({ organization: organizationId, isDefault: true });
    if(!project){
        project = await Project.create({
            name: 'Default',
            slug: 'default',
            organization: organizationId,
            isDefault: true
        });
    }

    // Environment (production, default).
    let environment = await Environment.findOne({ project: project._id, isDefault: true })
        ?? await Environment.findOne({ project: project._id, name: 'production' });
    if(!environment){
        environment = await Environment.create({
            name: 'production',
            type: 'production',
            organization: organizationId,
            project: project._id,
            isDefault: true
        });
    }

    return { project, environment };
};

/**
 * Provision a user's personal web-shell container (isUserContainer) under the
 * given organization, ONCE per user. The DB docs are created PURE (no Docker
 * daemon I/O, per ADR-0001); the real image/network/container are materialized
 * out-of-band by a reconcile the caller enqueues, and the personal shell also
 * self-heals on first console connect. Stamps `organization` on the image,
 * network and container (all three require it). Persists user.container +
 * the images/networks/containers arrays via updateOne (no save-hook re-trigger).
 *
 * No-op (returns the existing container) if the user already has one — keeps the
 * personal container a strict one-per-user invariant.
 *
 * @param user  - the owning user document.
 * @param orgId - the organization the personal container belongs to.
 */
export const createUserContainer = async (
    user: IUser,
    orgId: mongoose.Types.ObjectId | string
): Promise<IDockerContainer | null> => {
    try{
        const User = mongoose.model<IUser>('User');
        if(user.container){
            const existing = await DockerContainer.findById(user.container);
            if(existing) return existing as IDockerContainer;
        }
        const userId = user._id.toString();
        const image = await DockerImage.create({ name: 'alpine', tag: 'latest', user: userId, organization: orgId });
        const network = await DockerNetwork.create({ user: userId, organization: orgId, driver: 'bridge', name: userId });
        const container = await DockerContainer.create({
            name: userId,
            user: userId,
            organization: orgId,
            image: image._id,
            network: network._id,
            command: '/bin/sh',
            isUserContainer: true
        });
        // Persist the back-references without re-triggering the user save hooks.
        await User.updateOne(
            { _id: user._id },
            {
                container: container._id,
                $push: { images: image._id, networks: network._id, containers: container._id }
            }
        );
        // Keep the in-memory doc coherent for callers that continue using it.
        user.container = container._id as any;
        (user.images as any)?.push?.(image._id);
        (user.networks as any)?.push?.(network._id);
        (user.containers as any)?.push?.(container._id);
        return container as IDockerContainer;
    }catch(error){
        logger.error('@services/tenancy/provisioning.ts (createUserContainer): ' + error);
        return null;
    }
};

/**
 * Normalize a user id / ObjectId / hydrated doc into a loaded user document
 * (or null if an id was given that resolves to nothing).
 */
const hydrateUser = async (
    user: IUser | mongoose.Types.ObjectId | string
): Promise<IUser | null> => {
    if(typeof user === 'string' || user instanceof mongoose.Types.ObjectId){
        return mongoose.model<IUser>('User').findById(user);
    }
    return user as IUser;
};

/**
 * Fast path for ensureDefaultTenancy: if the user is ALREADY fully provisioned,
 * return the complete hierarchy. Returns null when any piece is missing so the
 * caller falls through and repairs it (resolve-or-create).
 */
const loadCompleteTenancy = async (userDoc: IUser): Promise<TenancyResult | null> => {
    if(!userDoc.defaultOrganization) return null;
    const organization = await Organization.findById(userDoc.defaultOrganization);
    if(!organization) return null;
    const project = await Project.findOne({ organization: organization._id, isDefault: true })
        ?? await Project.findOne({ organization: organization._id });
    const environment = project
        ? (await Environment.findOne({ project: project._id, isDefault: true })
            ?? await Environment.findOne({ project: project._id }))
        : null;
    const membership = await Membership.findOne({
        user: userDoc._id,
        organization: organization._id,
        project: null
    });
    if(project && environment && membership){
        return { organization, project, environment, membership };
    }
    return null;
};

/** Resolve-or-create the user's personal organization (keyed by owner + isPersonal). */
const ensurePersonalOrg = async (userDoc: IUser): Promise<IOrganization> => {
    const existing = await Organization.findOne({ owner: userDoc._id, isPersonal: true });
    if(existing) return existing;
    const slug = await ensureUniqueOrgSlug(slugify(userDoc.username));
    return Organization.create({
        name: userDoc.username,
        slug,
        owner: userDoc._id,
        isPersonal: true
    });
};

/** Resolve-or-create the owner membership (org-wide → project null). */
const ensureOwnerMembership = async (
    userDoc: IUser,
    organization: IOrganization
): Promise<IMembership> => {
    const existing = await Membership.findOne({
        user: userDoc._id,
        organization: organization._id,
        project: null
    });
    if(existing) return existing;
    return Membership.create({
        user: userDoc._id,
        organization: organization._id,
        project: null,
        role: 'owner'
    });
};

/** Persist the user's defaultOrganization back-ref without re-triggering save hooks. */
const linkDefaultOrganization = async (userDoc: IUser, organization: IOrganization): Promise<void> => {
    if(userDoc.defaultOrganization
        && userDoc.defaultOrganization.toString() === organization._id.toString()) return;
    await mongoose.model<IUser>('User').updateOne(
        { _id: userDoc._id },
        { defaultOrganization: organization._id }
    );
    userDoc.defaultOrganization = organization._id;
};

/**
 * Idempotently ensure a user has a personal tenancy hierarchy:
 * Organization (isPersonal) > Membership (owner) > Project (default) > Environment (production/default).
 *
 * If the user already has `defaultOrganization` set, the existing hierarchy is
 * loaded and returned without creating duplicates. Safe to call repeatedly and
 * safe to retry after a partial failure (each step is resolved-or-created).
 *
 * NOTE: with the explicit-org-setup model, new users no longer get a personal
 * org automatically — this remains only for the legacy backfill of pre-existing
 * accounts that already had a `defaultOrganization`. New first-org provisioning
 * lives in createOrganization (which reuses ensureOrgDefaults + createUserContainer).
 *
 * @param user - A loaded user document or a user id.
 */
export const ensureDefaultTenancy = async (
    user: IUser | mongoose.Types.ObjectId | string
): Promise<TenancyResult | null> => {
    try{
        const userDoc = await hydrateUser(user);
        if(!userDoc){
            logger.error('@services/tenancy/provisioning.ts (ensureDefaultTenancy): User not found.');
            return null;
        }
        const existing = await loadCompleteTenancy(userDoc);
        if(existing) return existing;

        const organization = await ensurePersonalOrg(userDoc);
        const membership = await ensureOwnerMembership(userDoc, organization);
        const { project, environment } = await ensureOrgDefaults(organization._id);
        await linkDefaultOrganization(userDoc, organization);

        return { organization, project, environment, membership };
    }catch(error){
        logger.error('@services/tenancy/provisioning.ts (ensureDefaultTenancy): ' + error);
        // Non-fatal: callers (e.g. the user post-save hook) must not break.
        return null;
    }
};

interface BackfillResult{
    usersProvisioned: number;
    reposBackfilled: number;
    // Per-collection count of documents stamped with a resolved `organization`.
    orgBackfilled: Record<string, number>;
}

/**
 * Idempotently stamp `organization` on every document of a newly-org-linked
 * collection that is missing it, resolving the org from a parent reference
 * already present on the document.
 *
 * Only touches docs where `organization` is missing/null. Resilient: a failure
 * to resolve any single document (or the whole collection) is logged and
 * skipped rather than thrown, so one bad collection never aborts the migration.
 *
 * @param childModelName  - registered Mongoose model name of the collection to backfill.
 * @param parentField     - field on the child doc holding the parent's id (e.g. 'repository', 'project', 'user').
 * @param parentModelName - registered Mongoose model name of the parent.
 * @param parentOrgField  - field on the parent holding the org id ('organization' or, for User, 'defaultOrganization').
 * @returns the number of documents stamped.
 */
const backfillOrgFromParent = async (
    childModelName: string,
    parentField: string,
    parentModelName: string,
    parentOrgField: string
): Promise<number> => {
    let count = 0;
    try{
        const ChildModel = mongoose.model(childModelName);
        // Only legacy rows missing the direct org ref.
        const docs = await ChildModel.find({
            $or: [
                { organization: { $exists: false } },
                { organization: null }
            ]
        }).select(parentField);
        if(docs.length === 0) return 0;

        const ParentModel = mongoose.model(parentModelName);
        // Cache parent → org lookups so shared parents are resolved once.
        const orgCache = new Map<string, mongoose.Types.ObjectId | null>();

        for(const doc of docs){
            const parentId = (doc as any)[parentField];
            if(!parentId) continue;
            const parentKey = parentId.toString();
            let orgId = orgCache.get(parentKey);
            if(orgId === undefined){
                const parent = await ParentModel.findById(parentId).select(parentOrgField).lean();
                const resolved: mongoose.Types.ObjectId | null =
                    parent ? (((parent as any)[parentOrgField] as mongoose.Types.ObjectId) ?? null) : null;
                orgId = resolved;
                orgCache.set(parentKey, resolved);
            }
            if(!orgId) continue;
            // strict:false so we can write `organization` even on docs whose
            // in-memory schema instance predates the field.
            await ChildModel.updateOne({ _id: doc._id }, { organization: orgId }, { strict: false });
            count++;
        }
    }catch(error){
        logger.error(`@services/tenancy/provisioning.ts (backfillOrgFromParent:${childModelName}): ` + error);
    }
    return count;
};

/**
 * One-time, idempotent migration that brings legacy data up to the tenancy model.
 * It NEVER creates organizations (the explicit-org-setup model forbids auto-orgs);
 * it only stamps the direct `organization` ref onto child collections that resolve
 * it from a parent which ALREADY has one:
 *  - every Repository without a `project`, whose owner already has a
 *    `defaultOrganization`, is attached to that org's default project/environment
 *    (and given a `sourceType` of 'github' if missing). Org-less owners are skipped.
 *  - Deployment/Domain/Database/Docker resources/Metric/etc. get `organization`
 *    stamped from their parent (repository/project/owner/container).
 *
 * Safe to run multiple times — already-attached repositories and already-stamped
 * documents are skipped.
 */
export const runTenancyBackfill = async (): Promise<BackfillResult> => {
    const User = mongoose.model<IUser>('User');
    const Repository = mongoose.model('Repository');

    let usersProvisioned = 0;
    let reposBackfilled = 0;
    const orgBackfilled: Record<string, number> = {};

    try{
        // --- Users -----------------------------------------------------------
        // NO auto-provision: under the explicit-org-setup model an org-less user
        // is valid and must create their first org via the UI. We never mint orgs
        // here. usersProvisioned stays 0 (kept for the report shape).

        // --- Repositories ----------------------------------------------------
        // Stamp org/project/environment ONLY for repos whose owner ALREADY has a
        // provisioned tenancy. Repos owned by an org-less user are left untouched
        // (no org is created on their behalf); they get stamped once the owner
        // creates an organization.
        const repositories = await Repository.find({
            $or: [
                { project: { $exists: false } },
                { project: null }
            ]
        });
        for(const repository of repositories){
            const ownerId = (repository as any).user;
            if(!ownerId){
                logger.error(`@services/tenancy/provisioning.ts (runTenancyBackfill): Repository ${repository._id} has no owner; skipping.`);
                continue;
            }
            const owner = await User.findById(ownerId);
            if(!owner){
                logger.error(`@services/tenancy/provisioning.ts (runTenancyBackfill): Owner ${ownerId} for repository ${repository._id} not found; skipping.`);
                continue;
            }
            // Skip repos whose owner has no organization — do NOT provision one.
            const orgId = (owner as any).defaultOrganization;
            if(!orgId){
                continue;
            }
            // Resolve the org's default project/environment (idempotent, no new org).
            const { project, environment } = await ensureOrgDefaults(orgId);
            const update: Record<string, unknown> = {
                organization: orgId,
                project: project._id,
                environment: environment._id
            };
            if(!(repository as any).sourceType){
                update.sourceType = 'github';
            }
            // strict:false so we can write fields that may not yet be in the schema.
            await Repository.updateOne({ _id: repository._id }, update, { strict: false });
            reposBackfilled++;
        }

        // --- Organization stamping on newly-org-linked collections -----------
        // Each pass is idempotent (only touches docs missing `organization`) and
        // self-contained (backfillOrgFromParent never throws). Repository already
        // got its org in the loop above; TemplateInstall/ApiToken already carry it.
        // Resolve via repository → repository.organization.
        orgBackfilled.Deployment = await backfillOrgFromParent('Deployment', 'repository', 'Repository', 'organization');
        orgBackfilled.Domain = await backfillOrgFromParent('Domain', 'repository', 'Repository', 'organization');
        orgBackfilled.HealthCheck = await backfillOrgFromParent('HealthCheck', 'repository', 'Repository', 'organization');
        // Resolve via project → project.organization.
        orgBackfilled.Database = await backfillOrgFromParent('Database', 'project', 'Project', 'organization');
        orgBackfilled.AlertChannel = await backfillOrgFromParent('AlertChannel', 'project', 'Project', 'organization');
        orgBackfilled.AlertRule = await backfillOrgFromParent('AlertRule', 'project', 'Project', 'organization');
        orgBackfilled.Environment = await backfillOrgFromParent('Environment', 'project', 'Project', 'organization');
        // Docker resources + port bindings: resolve via owner → user.defaultOrganization.
        // Run BEFORE Metric, which resolves its org from container.organization.
        orgBackfilled.DockerContainer = await backfillOrgFromParent('DockerContainer', 'user', 'User', 'defaultOrganization');
        orgBackfilled.DockerImage = await backfillOrgFromParent('DockerImage', 'user', 'User', 'defaultOrganization');
        orgBackfilled.DockerNetwork = await backfillOrgFromParent('DockerNetwork', 'user', 'User', 'defaultOrganization');
        orgBackfilled.PortBinding = await backfillOrgFromParent('PortBinding', 'user', 'User', 'defaultOrganization');
        // Metric: resolve via its container → container.organization (now stamped above).
        orgBackfilled.Metric = await backfillOrgFromParent('Metric', 'container', 'DockerContainer', 'organization');

        const orgSummary = Object.entries(orgBackfilled)
            .map(([name, n]) => `${name}=${n}`)
            .join(', ');
        logger.info(`@services/tenancy/provisioning.ts (runTenancyBackfill): Provisioned ${usersProvisioned} user(s), backfilled ${reposBackfilled} repository(ies). Organization stamped: ${orgSummary}.`);
    }catch(error){
        logger.error('@services/tenancy/provisioning.ts (runTenancyBackfill): ' + error);
    }

    return { usersProvisioned, reposBackfilled, orgBackfilled };
};
