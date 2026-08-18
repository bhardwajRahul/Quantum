import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useQuery, useDocumentTitle } from '@hooks/common';
import { createAccount } from '@services/github/operations';
import { setState as setGithubState } from '@services/github/slice';
import { Card, CardContent } from '@/components/ui/card';

const Authenticate = () => {
    const query = useQuery();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const { error } = useSelector((state) => state.github);
    useDocumentTitle('Authenticating Github Account');

    useEffect(() => {
        if(!user?._id) return;
        try {
            const accessToken = query.get('accessToken');
            const { id, username, avatar_url } = JSON.parse(query.get('data'));
            dispatch(createAccount({ accessToken, username, githubId: id, user: user._id, avatarUrl: avatar_url }));
        } catch(e) {
            dispatch(setGithubState({ path: 'error', value: String(e) }));
        }

    }, []);

    useEffect(() => {
        if(user?.github?._id) navigate('/dashboard');
    }, [user?.github?._id, navigate]);

    return (
        <div className='max-w-xl'>
            <Card>
                <CardContent className='p-8'>
                    {error ? (
                        <p className='text-sm text-destructive'>
                            {String(error)}
                        </p>
                    ) : (
                        <div className='flex items-center gap-4'>
                            <span className='h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                            <div>
                                <h2 className='text-lg font-semibold text-foreground'>
                                    Connecting your GitHub account
                                </h2>
                                <p className='mt-1 text-sm text-muted-foreground'>
                                    Please wait while we finish linking your account…
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Authenticate;
