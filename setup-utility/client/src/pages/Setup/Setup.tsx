import StepContainer from '@components/atoms/StepContainer';
import StepsContainer from '@components/molecules/StepsContainer';
import Input from '@components/atoms/Input';
import Button from '@components/atoms/Button';
import DeployOutput from '@components/molecules/DeployOutput';
import { HiArrowUpRight } from 'react-icons/hi2';
import './Setup.css';

const SetupPage = () => {

    return (
        <main id='Setup-Utility-Main'>
            <section className='Setup-Utility-Left-Container'>
                <StepsContainer>
                    {[
                        'Getting Started',
                        'Configuring Domains',
                        'Connecting to GitHub',
                        'Secret Keys (autogenerated)'
                    ].map((title, index) => (
                        <StepContainer key={index} title={title} />
                    ))}
                </StepsContainer>
            </section>

            <section className='Setup-Utility-Container'>
                <h3 className='Setup-Utility-Header-Title'>Deploying your Quantum instance.</h3>

                <form className='Setup-Utility-Form-Container'>
                    <Input
                        type='text'
                        placeholder='Server IP address (e.g. 152.53.39.92)'
                        helperText='The IP address of your server'
                    />

                    <Input
                        type='text'
                        placeholder='Client Application Domain (e.g. quantumapp.com)'
                        helperText='For example quantumapp.com. Through this domain, you will be able to access the platform to manage your deployments and more.'
                    />

                    <Input
                        type='text'
                        placeholder='Server Domain (e.g. quantumserver.com)'
                        helperText='For example quantumserver.com. This domain will be used to access the server API.'
                    />

                    <Input
                        type='text'
                        placeholder='Github Client ID (e.g. 1234567890)'
                        helperText='The client ID of your GitHub OAuth application.'
                    />

                    <Input
                        type='text'
                        placeholder='Github Client Secret (e.g. 0987654321)'
                        helperText='The client secret of your GitHub OAuth application.'
                    />

                    <div className='Setup-Utility-Form-Optional-Container'>
                        <h3 className='Setup-Utility-Form-Optional-Title'>Optional</h3>
                        <i className='Icon-Container'>
                            <HiArrowUpRight />
                        </i>
                    </div>

                    <Button text='Deploy' />
                </form>
            </section>

            <DeployOutput />
        </main>
    );
};

export default SetupPage;