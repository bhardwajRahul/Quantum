import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import LogsTerminal from '@/shared/components/terminal/LogsTerminal';
import ServicePicker from '@/modules/template/components/ServicePicker';
import type { TemplateInstall } from '@quantum/contracts/modules/template/domain';

const InstallLogs = () => {
    const { installId } = useParams<{ installId: string }>();
    const install = useOutletContext<TemplateInstall>();
    const [params, setParams] = useSearchParams();
    const service = params.get('service') ?? install.services.find((entry) => entry.kind === 'app')?.name ?? install.services[0]?.name;

    if(!installId || service === undefined) return null;

    return (
        <div className='flex min-h-0 flex-1 flex-col'>
            <LogsTerminal
                key={service}
                channelPath={`/template/install/${installId}/logs`}
                subscribePayload={{ service }}
                actions={<ServicePicker services={install.services} value={service} onChange={(name) => setParams({ service: name })} />}
                description={`Output of the ${service} container.`}
            />
        </div>
    );
};

export default InstallLogs;
