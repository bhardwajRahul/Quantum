import { Rocket } from 'lucide-react';
import EmptyState from '@/shared/components/EmptyState';
import CenterState from '@/shared/components/CenterState';
import PageBody from '@/shared/components/layout/PageBody';

const Dashboard = () => (
    <PageBody height='full'>
        <CenterState>
            <EmptyState
                icon={Rocket}
                title='Welcome to Quantum'
                description='Your applications, projects and usage will land here once the next waves ship.'
            />
        </CenterState>
    </PageBody>
);

export default Dashboard;
