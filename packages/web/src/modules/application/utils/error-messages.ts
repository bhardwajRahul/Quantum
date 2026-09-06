import { repositoryErrorMessages, deploymentErrorMessages } from '@/modules/repository/utils/error-messages';
import { databaseErrorMessages } from '@/modules/database/utils/error-messages';
import { templateErrorMessages } from '@/modules/template/utils/error-messages';

export const applicationErrorMessages = {
    ...repositoryErrorMessages,
    ...deploymentErrorMessages,
    ...databaseErrorMessages,
    ...templateErrorMessages
};
