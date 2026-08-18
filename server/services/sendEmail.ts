import nodemailer from 'nodemailer';
import logger from '@utilities/logger';
import { EmailOptions } from '@typings/services/emailHandler';

const IS_SMTP_DEFINED = (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_AUTH_USER &&
    process.env.SMTP_AUTH_PASSWORD &&
    process.env.WEBMASTER_MAIL
);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    auth: {
        user: process.env.SMTP_AUTH_USER,
        pass: process.env.SMTP_AUTH_PASSWORD
    },
    tls: { rejectUnauthorized: false }
});

const sendEmail = async({ to = process.env.WEBMASTER_MAIL, subject, html }: EmailOptions): Promise<void> => {
    if(!IS_SMTP_DEFINED) return;
    try{
        await transporter.sendMail({
            from: `Quantum Cloud Platform <${process.env.SMTP_AUTH_USER}>`,
            to,
            subject,
            html
        });
    }catch(error){
        logger.error('@services/sendEmail.ts (sendEmail): ' + error);
    }
};

export default sendEmail;