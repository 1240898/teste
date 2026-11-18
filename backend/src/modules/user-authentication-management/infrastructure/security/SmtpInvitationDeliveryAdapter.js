import nodemailer from 'nodemailer';

export class SmtpInvitationDeliveryAdapter {
  constructor({ host, port = 587, secure = false, user, password, from }) {
    Object.assign(this, { host, port, secure, user, password, from });
    this.transporter = null;
  }

  async sendInvitation(email, link, expiresAt) {
    if (!this.host || !this.from)
      throw new Error('SMTP_HOST and SMTP_FROM must be configured');
    if (Boolean(this.user) !== Boolean(this.password))
      throw new Error(
        'SMTP_USER and SMTP_PASSWORD must be configured together',
      );
    this.transporter ??= nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      ...(this.user ? { auth: { user: this.user, pass: this.password } } : {}),
    });
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Activate your LaPrizza account',
      text: `Use this single-use link before ${expiresAt.toISOString()}: ${link}`,
    });
  }
}
