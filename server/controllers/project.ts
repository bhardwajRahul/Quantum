import slugify from 'slugify';
import { v4 } from 'uuid';
import Project from '@models/project';
import HandlerFactory from '@controllers/common/handlerFactory';
import RuntimeError from '@utilities/runtimeError';
import { catchAsync } from '@utilities/helpers';
import { enqueueProjectCascadeDelete } from '@services/orchestrator';
import { IRequest } from '@typings/controllers/common';
import { Response, NextFunction } from 'express';

const ProjectFactory = new HandlerFactory({
    model: Project,
    scope: { field: 'organization' },
    fields: ['name', 'isDefault']
});

export const getProjects = ProjectFactory.getAll();
export const getProject = ProjectFactory.getOne();
export const updateProject = ProjectFactory.updateOne();

export const createProject = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const organization = req.tenant?.org?._id;
    if(!organization){
        return next(new RuntimeError('Project::Organization::Required', 400));
    }
    const slug = `${slugify(req.body.name, { lower: true, strict: true })}-${v4().slice(0, 4)}`;
    const project = await Project.create({ name: req.body.name, slug, organization });
    res.status(201).json({ status: 'success', data: project });
});

export const deleteProject = catchAsync(async (req: IRequest, res: Response, next: NextFunction): Promise<void> => {
    const orgFilter = req.tenant?.isPlatformAdmin
        ? {}
        : { organization: req.tenant?.org?._id };
    const project = await Project.findOne({ _id: req.params.id, ...orgFilter });
    if(!project){
        return next(new RuntimeError('Project::NotFound', 404));
    }
    if(project.isDefault){
        return next(new RuntimeError('Project::Default::CannotDelete', 400));
    }

    const user: any = req.user;
    await enqueueProjectCascadeDelete(String(project._id), { userId: String(user._id) });

    res.status(202).json({
        status: 'success',
        data: { id: String(project._id), message: 'Project deletion enqueued.' }
    });
});

export default {
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject
};
