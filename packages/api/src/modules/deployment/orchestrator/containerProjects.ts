import DockerContainer from '@/modules/docker/models/DockerContainer';
import { config } from '@/shared/config';

const table = (name: string): string =>
    config.databaseSchema === undefined ? `"${name}"` : `"${config.databaseSchema}"."${name}"`;

const statements = (): string[] => {
    const container = table('docker_container');
    return [
        `UPDATE ${container} c SET "projectId" = r."projectId" FROM ${table('repository')} r WHERE c."projectId" IS NULL AND c."repositoryId" = r.id`,
        `UPDATE ${container} c SET "projectId" = d."projectId" FROM ${table('database')} d WHERE c."projectId" IS NULL AND d."containerId" = c.id`,
        `UPDATE ${container} c SET "projectId" = s."projectId" FROM ${table('codespace')} s WHERE c."projectId" IS NULL AND s."containerId" = c.id`,
        `UPDATE ${container} c SET "projectId" = i."projectId" FROM ${table('template_install')} i, jsonb_array_elements(i.services) service WHERE c."projectId" IS NULL AND (service->>'containerId')::int = c.id`,
        `UPDATE ${table('metric')} m SET "projectId" = c."projectId" FROM ${container} c WHERE m."projectId" IS NULL AND m."containerId" = c.id AND c."projectId" IS NOT NULL`
    ];
};

export const backfillContainerProjects = async (): Promise<number> => {
    const runner = DockerContainer.getRepository().manager.connection.createQueryRunner();
    let updated = 0;
    try{
        for(const statement of statements()){
            const result = await runner.query(statement, [], true);
            updated += result.affected ?? 0;
        }
    }finally{
        await runner.release();
    }
    return updated;
};
