import SecretCipher from '@/shared/services/SecretCipher';
import Template from '../models/Template';
import type TemplateInstall from '../models/TemplateInstall';
import type { TemplateServiceSpec, TemplateSpec } from '@quantum/contracts/modules/template/domain';

const interpolate = (value: string, inputs: Record<string, string>): string =>
    value.replace(/\{\{\s*(\w+)\s*\}\}|\$\{(\w+)\}/g, (match, braces: string | undefined, dollar: string | undefined) => {
        const key = braces ?? dollar ?? '';
        return inputs[key] !== undefined ? inputs[key] : match;
    });

export const installInputs = (install: TemplateInstall): Record<string, string> => {
    if(!install.inputsEnc) return {};
    try{
        return JSON.parse(new SecretCipher().decrypt(install.inputsEnc)) as Record<string, string>;
    }catch{
        return {};
    }
};

export const installSpec = async (install: TemplateInstall): Promise<TemplateSpec | null> => {
    if(install.spec) return install.spec;
    if(install.templateId === null) return null;

    const template = await Template.findOneBy({ id: install.templateId });
    return template?.spec ?? null;
};

export const serviceEnvironment = (
    install: TemplateInstall,
    name: string,
    spec: TemplateServiceSpec,
    inputs: Record<string, string>
): Record<string, string> => {
    const override = install.environment?.[name];
    if(override !== undefined) return override;

    return Object.fromEntries(
        Object.entries(spec.environment ?? {}).map(([key, value]) => [key, interpolate(String(value), inputs)])
    );
};
