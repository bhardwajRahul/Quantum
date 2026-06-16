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

import express from 'express';
import * as templateController from '@controllers/template';
import * as authMiddleware from '@middlewares/authentication';
import { resolveTenant, resolveTenantDiscovery, requirePermission } from '@middlewares/tenancy';
import validate from '@middlewares/validation';
import {
    CreateTemplateSchema,
    InstallTemplateSchema,
    IdParamsSchema,
    OrgIdParamsSchema,
    ProjectIdParamsSchema
} from '@middlewares/validators';

const router = express.Router();

router.use(authMiddleware.protect);

// Catalog (builtins + caller's custom templates). The catalog is GLOBAL-readable:
// builtins (organization:null) must show even for a user with no org yet, so these
// reads use resolveTenantDiscovery (resolves the org if present, never 409s without
// one). The controller OR-merges the resolved org set with the global builtins.
router.get('/', resolveTenantDiscovery, templateController.getTemplates);
router.get('/categories', resolveTenantDiscovery, templateController.getCategories);

// Custom template authoring under an org (project:write). The org comes from the
// :orgId route param (resolved inline so resolveTenant sees it).
router.post(
    '/organization/:orgId',
    validate(OrgIdParamsSchema, 'params'),
    resolveTenant,
    requirePermission('project:write'),
    validate(CreateTemplateSchema),
    templateController.createTemplate
);

// Install a template into a project (deploy). Enqueues template:install → 202.
router.post(
    '/project/:projectId/install',
    validate(ProjectIdParamsSchema, 'params'),
    resolveTenant,
    requirePermission('deploy'),
    validate(InstallTemplateSchema),
    templateController.installTemplate
);

router.get('/:id', validate(IdParamsSchema, 'params'), resolveTenantDiscovery, templateController.getTemplate);
router.delete('/:id', validate(IdParamsSchema, 'params'), resolveTenant, requirePermission('project:write'), templateController.deleteTemplate);

export default router;
