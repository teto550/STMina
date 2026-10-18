// The email to the admin: settings come from build-time variables, the request goes through the app's axios instance.
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/core/http', () => ({ http: { post } }));

import { sendAdminEmail, sendUnauthorizedAlert } from '@/api/email';

const configure = () => {
  vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'svc');
  vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', 'tpl');
  vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'pub');
  vi.stubEnv('VITE_ADMIN_EMAIL', 'admin@x.com');
};

beforeEach(() => { post.mockReset(); post.mockResolvedValue({}); vi.unstubAllEnvs(); });

describe('sendAdminEmail', () => {
  it('posts the new servant to EmailJS with the configured service, template and key', async () => {
    configure();
    await sendAdminEmail({ name: 'يوسف', email: 'y@x.com', grade: 'سنة رابعة ابتدائي', uid: 'u1' });
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('https://api.emailjs.com/api/v1.0/email/send');
    expect(body).toMatchObject({ service_id: 'svc', template_id: 'tpl', user_id: 'pub' });
    expect(body.template_params).toMatchObject({ admin_email: 'admin@x.com', deacon_name: 'يوسف', deacon_email: 'y@x.com', deacon_grade: 'سنة رابعة ابتدائي', deacon_uid: 'u1' });
    expect(body.template_params.approve_link).toContain('?approve=u1');
  });

  it('does nothing (and says why) when EmailJS is not configured, so a registration is never blocked by it', async () => {
    await expect(sendAdminEmail({ name: 'x', email: 'x@x.com', grade: 'g', uid: 'u' })).rejects.toThrow(/not configured/);
    expect(post).not.toHaveBeenCalled();
  });

  it('a missing admin address still sends (the template may have a fixed recipient), with an empty admin_email', async () => {
    configure();
    vi.stubEnv('VITE_ADMIN_EMAIL', '');
    await sendAdminEmail({ name: 'x', email: 'x@x.com', grade: 'g', uid: 'u' });
    expect(post.mock.calls[0]![1].template_params.admin_email).toBe('');
  });

  it('passes a failing request on to the caller (registerServant ignores it)', async () => {
    configure();
    post.mockRejectedValue(new Error('network'));
    await expect(sendAdminEmail({ name: 'x', email: 'x@x.com', grade: 'g', uid: 'u' })).rejects.toThrow('network');
  });
});

describe('sendUnauthorizedAlert', () => {
  it('sends a warning in the name field and no approve link', async () => {
    configure();
    await sendUnauthorizedAlert('x@x.com', 'u9');
    const params = post.mock.calls[0]![1].template_params;
    expect(params.deacon_name).toContain('تنبيه أمني');
    expect(params).toMatchObject({ deacon_email: 'x@x.com', deacon_uid: 'u9', admin_email: 'admin@x.com' });
    expect(params.approve_link).not.toContain('?approve=');
  });
  it('does nothing when not configured', async () => {
    await expect(sendUnauthorizedAlert('x@x.com', 'u9')).rejects.toThrow(/not configured/);
    expect(post).not.toHaveBeenCalled();
  });
});
