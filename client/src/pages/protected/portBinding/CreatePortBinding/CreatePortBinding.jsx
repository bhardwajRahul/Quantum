import React, { useEffect } from 'react';
import MinimalForm from '@components/organisms/MinimalForm';
import { useUserDockerContainers, useUserRepositories } from '@hooks/api/user';
import CreatePortBindingImage from '@images/CreatePortBinding.jpeg';
import { useDispatch, useSelector } from 'react-redux';
import { createPortBinding } from '@services/portBinding/operations';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@hooks/common';
import { getRandomAvailablePort } from '@services/docker/container/operations';
import './CreatePortBinding.css';

const CreatePortBinding = () => {
    const { 
        randomAvailablePort, 
        isRandomAvailablePortLoading, 
        selectedDockerContainer } = useSelector((state) => state.dockerContainer);
    const { error, isOperationLoading } = useSelector((state) => state.portBinding);
    const { dockerContainers } = useUserDockerContainers();
    const { repositories } = useUserRepositories();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    useDocumentTitle('Port Binding');

    useEffect(() => {
        dispatch(getRandomAvailablePort());
    }, []);

    const handleFormSubmit = (formValues) => {
        dispatch(createPortBinding(formValues, navigate));
    };

    return !isRandomAvailablePortLoading && (
        <MinimalForm
            error={error}
            isLoading={isOperationLoading}
            submitButtonTitle='Create Port Binding'
            variant='Form-Image'
            formImage={CreatePortBindingImage}
            breadcrumbsItems={[
                { title: 'Home', to: '/' },
                { title: 'Dashboard', to: '/dashboard/' },
                { title: 'Port Bindings', to: '/dashboard/' },
                { title: 'Create Port Binding', to: '/port-binding/create/' }
            ]}
            handleFormSubmit={handleFormSubmit}
            headerTitle='Service Ports and Protocol Configuration'
            headerSubtitle='Configure internal and external ports for your Docker service and select the appropriate communication protocol.'
            RightContainerComponent={() => {}}
            formInputs={[
                {
                    type: 'number',
                    name: 'internalPort',
                    placeholder: 'Enter the internal port number (e.g., 8080)',
                    helperText: 'Specify the port your service listens to inside the Docker container.',
                },
                {
                    type: 'text',
                    name: 'externalPort',
                    value: randomAvailablePort,
                    placeholder: 'Enter the external port number (e.g., 3000)',
                    helperText: 'Specify the external port accessible from the public IP. A random available port is preselected.',
                },
                {
                    type: 'select',
                    value: selectedDockerContainer?._id,
                    name: 'container',
                    options: [ ...dockerContainers.map(({ name, _id, ipAddress }) => [_id, `${name} (${ipAddress})`]), ...repositories.map(({ container }) => [container._id, `${container.name} (${container.ipAddress})`]) ],
                    placeholder: 'Choose containers to connect',
                    helperText: 'Select the containers you wish to connect to this network. You can choose one or multiple containers from the list.'
                },
                {
                    type: 'select',
                    name: 'protocol',
                    options: [
                        ['tcp', 'TCP (Reliable delivery for Web Servers, Databases, and general data transfer)'],
                        ['udp', 'UDP (Fast and efficient for Streaming Media, Gaming, and IoT applications)']
                    ],
                    placeholder: 'Select a protocol',
                    helperText: 'Choose the communication protocol your service will use. TCP is reliable, while UDP is faster but less reliable.',
                }
            ]}
        />
    );
};

export default CreatePortBinding;