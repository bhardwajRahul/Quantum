import { Rocket } from 'lucide-react';
import EmptyState from '@/shared/components/EmptyState';
import PageBody from '@/shared/components/layout/PageBody';

const Dashboard = () => (
    <PageBody>
        <EmptyState
            icon={Rocket}
            title='Welcome to Quantum'
            description='Your applications, projects and usage will land here once the next waves ship.'
        />
    </PageBody>
);

export default Dashboard;
