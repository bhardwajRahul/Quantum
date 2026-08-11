import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '@/shared/config';
import { logger } from '@/shared/utils/Logger';
import type { SendEmailPayload } from '../contracts/domain/notification';

const isConfigured = Boolean(config.smtp.host && config.smtp.from);

export default class MailService{
    #transporter: Transporter | undefined = isConfigured
        ? nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: config.smtp.user
                ? { user: config.smtp.user, pass: config.smtp.password }
                : undefined,
            tls: { rejectUnauthorized: false }
        })
        : undefined;

    async send(payload: SendEmailPayload){
        if(!this.#transporter){
            logger.debug('SMTP not configured; email skipped', { scope: 'mail' });
            return;
        }

        await this.#transporter.sendMail({
            from: `Quantum Cloud Platform <${config.smtp.from}>`,
            ...payload
        });
    }
}
