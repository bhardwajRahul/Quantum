import { DefineEventGroup, Event } from '@/shared/events/EventGroup';
import MailService from '../services/MailService';
import type { SendEmailPayload } from '../contracts/domain/notification';

@DefineEventGroup('notification')
export default class NotificationEvents{
    #mail = new MailService();

    @Event('send')
    send(payload: SendEmailPayload){
        return this.#mail.send(payload);
    }
}
