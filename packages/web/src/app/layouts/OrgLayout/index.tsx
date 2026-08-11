import { Outlet } from 'react-router-dom';
import OrgGate from '@/modules/organization/components/OrgGate';

const OrgLayout = () => (
    <OrgGate>
        <Outlet />
    </OrgGate>
);

export default OrgLayout;
