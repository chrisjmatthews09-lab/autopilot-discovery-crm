export const ALLOWED_EMAILS = ['chrisjmatthews09@gmail.com'];

export const isAllowedEmail = (email) =>
  !!email && ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
