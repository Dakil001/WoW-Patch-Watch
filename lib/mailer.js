'use strict';

const net = require('node:net');
const { t, normalizeLanguage, localeForLanguage } = require('./i18n');

let nodemailerModule = null;

function getNodemailer() {
  if (!nodemailerModule) nodemailerModule = require('nodemailer');
  return nodemailerModule;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function isValidHostname(value) {
  const host = normalizeText(value).toLowerCase();
  if (!host || host.length > 253) return false;
  if (net.isIP(host)) return true;
  if (host.endsWith('.')) return false;
  const labels = host.split('.');
  if (labels.length < 2) return false;
  return labels.every((label) => (
    label.length >= 1
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  ));
}

function explainInvalidHost(host, language = 'de') {
  const value = normalizeText(host);
  if (!value) return t(language, 'error.smtpHostMissing');
  if (/^https?:\/\//i.test(value)) return t(language, 'error.smtpHostUrl');
  if (value.includes('@')) {
    const domain = value.split('@').pop().toLowerCase();
    if (domain === 'mail.de') return t(language, 'error.smtpHostEmailMailDe', { value });
    return t(language, 'error.smtpHostEmail');
  }
  return t(language, 'error.smtpHostInvalid', { value });
}

function splitRecipients(value) {
  return normalizeText(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidEmailAddress(value) {
  const address = normalizeText(value);
  return address.length <= 320
    && !/[\r\n]/.test(address)
    && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address);
}

function validateEmailSettings(email, language = 'de') {
  if (!email?.enabled) throw new Error(t(language, 'error.smtpDisabled'));

  const host = normalizeText(email.host);
  if (!isValidHostname(host)) throw new Error(explainInvalidHost(host, language));

  if (!Number.isInteger(Number(email.port)) || Number(email.port) < 1 || Number(email.port) > 65535) {
    throw new Error(t(language, 'error.smtpPort'));
  }

  const user = normalizeText(email.user);
  if (!user) throw new Error(t(language, 'error.smtpUserMissing'));
  if (/[\r\n]/.test(user)) throw new Error(t(language, 'error.smtpUserInvalid'));
  if (!email.password) throw new Error(t(language, 'error.smtpPasswordMissing'));

  const recipients = splitRecipients(email.to);
  if (!recipients.length) throw new Error(t(language, 'error.smtpRecipientMissing'));
  const invalidRecipient = recipients.find((address) => !isValidEmailAddress(address));
  if (invalidRecipient) throw new Error(t(language, 'error.smtpRecipientInvalid', { value: invalidRecipient }));

  const from = normalizeText(email.from);
  if (from && !isValidEmailAddress(from)) throw new Error(t(language, 'error.smtpFromInvalid'));
}

function friendlySmtpError(error, email, language = 'de') {
  const code = String(error?.code || '').toUpperCase();
  const command = String(error?.command || '').toUpperCase();
  const message = String(error?.message || error || t(language, 'error.smtpUnknown'));
  const host = normalizeText(email?.host);

  if (code === 'EBADNAME' || code === 'ENOTFOUND') {
    return new Error(t(language, 'error.smtpNotFound', { host }));
  }
  if (code === 'ECONNREFUSED') {
    return new Error(t(language, 'error.smtpRefused', { host }));
  }
  if (code === 'EAUTH' || /auth|login|credentials|password/i.test(message)) {
    return new Error(t(language, 'error.smtpAuth'));
  }
  if (/certificate|self[- ]signed|tls|ssl/i.test(message)) {
    return new Error(t(language, 'error.smtpTls'));
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || command === 'CONN') {
    return new Error(t(language, 'error.smtpTimeout', { host }));
  }
  return new Error(t(language, 'error.smtpGeneric', { message }));
}

function createTransport(email, language = 'de') {
  validateEmailSettings(email, language);
  return getNodemailer().createTransport({
    host: normalizeText(email.host),
    port: Number(email.port),
    secure: Boolean(email.secure),
    requireTLS: !Boolean(email.secure) && Number(email.port) === 587,
    auth: {
      user: normalizeText(email.user),
      pass: email.password
    },
    tls: {
      rejectUnauthorized: true
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
}

async function sendTestEmail(email, language = 'de') {
  const lang = normalizeLanguage(language);
  try {
    const transporter = createTransport(email, lang);
    await transporter.verify();
    return await transporter.sendMail({
      from: normalizeText(email.from) || normalizeText(email.user),
      to: splitRecipients(email.to).join(', '),
      subject: t(lang, 'email.testSubject'),
      text: [
        t(lang, 'email.testBody1'),
        '',
        t(lang, 'email.testBody2')
      ].join('\n')
    });
  } catch (error) {
    if (!error?.code || error.code === 'EWPWCONFIG') throw error;
    throw friendlySmtpError(error, email, lang);
  }
}

function interfaceId(snapshot) {
  if (!snapshot?.version) return null;
  if (snapshot.interfaceId) return snapshot.interfaceId;
  const parts = String(snapshot.version).match(/\d+/g)?.map(Number) || [];
  if (parts.length < 3) return null;
  return (parts[0] * 10000) + (parts[1] * 100) + parts[2];
}

function formatSnapshot(snapshot, language = 'de') {
  if (!snapshot) return t(language, 'email.unavailable');
  const api = interfaceId(snapshot);
  return `${snapshot.version} (Build ${snapshot.buildId}${api ? `, ${t(language, 'snapshot.interface', { id: api })}` : ''})`;
}

function formatAddonSection(addons, language = 'de') {
  if (!addons?.length) return `${t(language, 'email.affectedAddons')}\n${t(language, 'email.noAddons')}`;
  return `${t(language, 'email.affectedAddons')}\n${addons.map((addon) => `- ${addon}`).join('\n')}`;
}

function formatChange(change, language = 'de') {
  return [
    `${change.gameName} – ${change.channel === 'ptr' ? t(language, 'email.ptrChannel') : t(language, 'email.liveChannel')}`,
    t(language, 'email.previous', { value: formatSnapshot(change.previous, language) }),
    t(language, 'email.new', { value: formatSnapshot(change.current, language) }),
    '',
    formatAddonSection(change.addons, language)
  ].join('\n');
}

async function sendChangeEmail(email, changes, language = 'de') {
  const lang = normalizeLanguage(language);
  try {
    const transporter = createTransport(email, lang);
    const subject = changes.length === 1
      ? t(lang, 'email.changeSubjectOne')
      : t(lang, 'email.changeSubjectMany', { count: changes.length });
    const body = [
      t(lang, 'email.changeIntro'),
      '',
      changes.map((change) => formatChange(change, lang)).join('\n\n----------------------------------------\n\n'),
      '',
      t(lang, 'email.checkedAt', { date: new Date().toLocaleString(localeForLanguage(lang)) })
    ].join('\n');
    return await transporter.sendMail({
      from: normalizeText(email.from) || normalizeText(email.user),
      to: splitRecipients(email.to).join(', '),
      subject,
      text: body
    });
  } catch (error) {
    if (!error?.code || error.code === 'EWPWCONFIG') throw error;
    throw friendlySmtpError(error, email, lang);
  }
}

module.exports = {
  sendTestEmail,
  sendChangeEmail,
  formatChange,
  validateEmailSettings,
  isValidHostname,
  explainInvalidHost,
  friendlySmtpError
};
