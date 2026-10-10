// The two emails the app sends to the admin, through EmailJS's web API with the app's axios instance (no script from a CDN).
// The settings are build-time variables (.env.local, and the GitHub Actions secrets of the same names for the published site):
//   VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY   from the EmailJS dashboard
//   VITE_ADMIN_EMAIL                                                              who receives the email (the template's {{admin_email}})
// Without them nothing is sent (and nothing else breaks: a registration does not depend on the email).
import { http } from '@/core/http';

const SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

const settings = () => {
  const env = import.meta.env;
  return { service: env.VITE_EMAILJS_SERVICE_ID as string | undefined, template: env.VITE_EMAILJS_TEMPLATE_ID as string | undefined, publicKey: env.VITE_EMAILJS_PUBLIC_KEY as string | undefined, adminEmail: (env.VITE_ADMIN_EMAIL as string | undefined) ?? '' };
};

async function sendTemplate(params: (adminEmail: string) => Record<string, string>): Promise<void> {
  const { service, template, publicKey, adminEmail } = settings();
  if (!service || !template || !publicKey) {
    throw new Error('EmailJS is not configured (VITE_EMAILJS_* are empty)');
  }
  await http.post(SEND_URL, { service_id: service, template_id: template, user_id: publicKey, template_params: params(adminEmail) }, { timeout: 10000 });
}

/** "a new servant asked to join": the admin approves from the link in the email. */
export async function sendAdminEmail(input: { name: string; email: string; grade: string; uid: string }): Promise<void> {
  await sendTemplate((adminEmail) => ({
    admin_email: adminEmail,
    deacon_name: input.name,
    deacon_email: input.email,
    deacon_grade: input.grade,
    deacon_uid: input.uid,
    approve_link: `${location.origin}${location.pathname}?approve=${input.uid}`,
  }));
}

/**
 * Security alert: someone signed in with a Firebase account that never went through the "new servant" form (so it has no `users`
 * record). Same template, with a warning in the name and no approve link, so nobody approves it by mistake.
 */
export async function sendUnauthorizedAlert(email: string, uid: string): Promise<void> {
  await sendTemplate((adminEmail) => ({
    admin_email: adminEmail,
    deacon_name: '⚠️ تنبيه أمني: حساب مش مسجل حاول يدخل البرنامج',
    deacon_email: email,
    deacon_grade: '—',
    deacon_uid: uid,
    approve_link: '(محدش يوافق على الحساب ده — راجعه في Firebase Console → Authentication)',
  }));
}
