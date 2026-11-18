import nodemailer from 'nodemailer';

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

export class SmtpRecoveryDeliveryAdapter {
  constructor({ host, port = 587, secure = false, user, password, from }) {
    Object.assign(this, { host, port, secure, user, password, from });
    this.transporter = null;
  }

  async sendRecoveryLink(email, link) {
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
    const safeLink = escapeHtml(link);
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'LaPrizza password recovery',
      text: `Use this single-use link to reset your password: ${link}`,
      html: `<p>Use this single-use link to reset your LaPrizza password:</p><p><a href="${safeLink}">Reset password</a></p>`,
    });
  }
}
