import { test, expect, type Page } from '@playwright/test';
const profile = { displayName: 'Tester', bio: '', interests: '', timeZone: 'Asia/Kolkata', weekStart: 'monday', units: 'metric', theme: 'light', palette: 'mint', reducedMotion: false, ageConfirmed: true };
const user = { id: 'test-user', name: 'Tester', email: 'tester@example.test' };
// These UI regression tests stub the API; backend authorization has separate API tests.
async function mock(page: Page, state: { signedIn: boolean; onboarded?: boolean; enabled?: boolean }) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/account-config') return route.fulfill({ json: { enabled: state.enabled !== false, google: false } });
    if (path === '/api/auth/sign-out') { state.signedIn = false; return route.fulfill({ json: { success: true } }); }
    if (!state.signedIn) return route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } });
    if (path === '/api/me') return route.fulfill({ json: { user, profile: state.onboarded === false ? null : profile } });
    if (path === '/api/habits') return route.fulfill({ json: { date: '2026-11-03', timeZone: 'Asia/Kolkata', habits: [{ id: 'test-habit', title: 'Private reading habit', category: 'Learning', target: 1, unit: 'session', value: 0 }] } });
    return route.fulfill({ status: 404, json: {} });
  });
}
async function noWorkspace(page: Page) {
  await expect(page.getByRole('button', { name: /Add a habit|Create your first habit/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Today/ })).toHaveCount(0);
  await expect(page.getByText('Private reading habit')).toHaveCount(0);
  await expect(page.getByText('Browser demo', { exact: true })).toHaveCount(0);
}
test('signed-out entry, reload and brand navigation never expose demo or habits', async ({ page }) => {
  await mock(page, { signedIn: false });
  await page.addInitScript(() => localStorage.setItem('momentin.demo.v1', JSON.stringify({ habits: [{ title: 'Old demo habit' }] })));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await noWorkspace(page);
  await expect(page.getByText('Old demo habit')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByRole('link', { name: /momentin/ }).click();
  await noWorkspace(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await noWorkspace(page);
});
test('valid session opens habits; logout and reload return to sign-in', async ({ page }) => {
  const state = { signedIn: true }; await mock(page, state);
  await page.goto('/'); await expect(page.getByText('Private reading habit')).toBeVisible();
  await page.getByRole('button', { name: /Your account/ }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await noWorkspace(page);
  await page.reload(); await noWorkspace(page);
});
test('incomplete onboarding and brand navigation cannot open habits', async ({ page }) => {
  await mock(page, { signedIn: true, onboarded: false });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Let’s set up your day' })).toBeVisible();
  await page.getByRole('link', { name: /momentin/ }).click(); await noWorkspace(page);
});
test('expired session clears private data and unsaved habit form', async ({ page }) => {
  const state = { signedIn: true }; await mock(page, state);
  await page.goto('/'); await page.getByRole('button', { name: '+ Add a habit', exact: true }).click();
  await page.getByLabel('Habit name').fill('Unsaved habit'); await page.locator('input[name="unit"]').fill('pages'); state.signedIn = false;
  await page.getByRole('button', { name: 'Create habit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await noWorkspace(page);
});
test('unconfigured accounts and owner entry never unlock habits', async ({ page }) => {
  await mock(page, { signedIn: false, enabled: false });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Accounts are being connected' })).toBeVisible();
  await noWorkspace(page);
  await expect(page.getByRole('button', { name: 'Owner access', exact: true })).toHaveCount(0);
});
test('mobile sign-in stays within viewport and reset links stay on account screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mock(page, { signedIn: false });
  await page.goto('/?account=reset&token=test-token');
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await noWorkspace(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('blocked signup displays the server rejection rather than an email success notice', async ({ page }) => {
  await mock(page, { signedIn: false });
  await page.route('**/api/auth/sign-up/email', route => route.fulfill({ status: 403, json: { code: 'INVITE_REQUIRED', message: 'This email is not invited. No account was created and no verification email was sent.' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Display name').fill('Test');
  await page.getByLabel('Username', { exact: true }).fill('testuser');
  await page.getByLabel('Email', { exact: true }).fill('blocked@example.test');
  await page.locator('input[name="password"]').fill('test-password-only-123');
  await page.getByLabel('I am at least 13 years old.').check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No account was created');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/momentin.svg');
  expect((await page.request.get('/momentin.svg')).status()).toBe(200);
});
for (const outcome of [
  { status: 201, code: 'ACCOUNT_CREATED', message: 'Account created. Check your email to verify your account.', role: 'status' as const },
  { status: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'An account already exists with this email. Please sign in.', role: 'alert' as const },
  { status: 400, code: 'USERNAME_IS_ALREADY_TAKEN', message: 'This username is already taken. Please choose another.', role: 'alert' as const },
  { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Account creation failed. Please try again shortly.', role: 'alert' as const },
  { status: 502, code: 'ACCOUNT_CREATED_EMAIL_FAILED', message: 'Account created, but the verification email could not be sent. Please use Resend verification email.', role: 'alert' as const },
]) test(`signup ${outcome.code} is visible in a top-right toast while scrolled down`, async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await mock(page, { signedIn: false });
  await page.route('**/api/auth/sign-up/email', route => route.fulfill({ status: outcome.status, json: { code: outcome.code, message: outcome.message, user } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByLabel('Username', { exact: true }).fill('testuser');
  await page.getByLabel('Email', { exact: true }).fill('tester@example.test');
  await page.locator('input[name="password"]').fill('test-password-only-123');
  await page.getByLabel('I am at least 13 years old.').check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const toast = page.getByRole(outcome.role);
  await expect(toast).toContainText(outcome.message);
  const box = await toast.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThanOrEqual(24);
  expect(box!.x + box!.width).toBeGreaterThan(850);
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(toast).toHaveCount(0);
});
test('switching account forms clears typed passwords and separates resend from sign-in', async ({ page }) => {
  await mock(page, { signedIn: false });
  await page.route('**/api/auth/sign-up/email', route => route.fulfill({ status: 409, json: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account already exists with this email. Please sign in.' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Display name').fill('Tester');
  await page.getByLabel('Username', { exact: true }).fill('testuser');
  await page.getByLabel('Email', { exact: true }).fill('tester@example.test');
  await page.locator('input[name="password"]').fill('test-password-only-123');
  await page.getByLabel('I am at least 13 years old.').check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(page.locator('input[name="password"]')).toHaveValue('');
  const signIn = await page.getByRole('button', { name: 'Sign in →', exact: true }).boundingBox();
  const resend = await page.getByRole('button', { name: 'Resend verification email' }).boundingBox();
  expect(resend!.y - signIn!.y - signIn!.height).toBeGreaterThanOrEqual(16);
});
test('short desktop sidebar scrolls, collapses and color mode saves without leaving Today', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 500 });
  await mock(page, { signedIn: true });
  let savedTheme = '';
  await page.route('**/api/me', async route => {
    if (route.request().method() === 'PUT') {
      savedTheme = route.request().postDataJSON().theme;
      return route.fulfill({ json: { profile: { ...profile, theme: savedTheme } } });
    }
    return route.fulfill({ json: { user, profile } });
  });
  await page.goto('/');
  await expect(page.getByText('Private reading habit')).toBeVisible();
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  expect(await sidebar.evaluate(el => { el.scrollTop = 200; return el.scrollTop; })).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  expect((await sidebar.boundingBox())!.width).toBe(84);
  await page.getByRole('button', { name: 'Toggle light and dark mode' }).click();
  await expect.poll(() => savedTheme).toBe('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('Private reading habit')).toBeVisible();
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await page.screenshot({ path: '/tmp/momentin-sidebar.png' });
});
test('habit labels explain quantities and mobile navigation fits', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page, { signedIn: true });
  await page.goto('/');
  await page.getByRole('button', { name: '+ Add a habit', exact: true }).click();
  await expect(page.getByText('How much you want to complete each day. For 20 pages, enter 20.')).toBeVisible();
  await expect(page.locator('input[name="unit"]')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Toggle light and dark mode' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/momentin-habit-mobile.png', fullPage: true });
});


test('Google is available on signup and signin and starts OAuth without email form validation', async ({ page }) => {
  await mock(page, { signedIn: false });
  await page.route('**/api/account-config', route => route.fulfill({ json: { enabled: true, google: true } }));
  await page.route('**/api/auth/sign-in/social', route => route.fulfill({ status: 503, json: { message: 'Google is temporarily unavailable. Please try again.' } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  const request = page.waitForRequest('**/api/auth/sign-in/social');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  expect((await request).postDataJSON()).toMatchObject({ provider: 'google' });
  await expect(page.getByRole('alert')).toContainText('Google is temporarily unavailable');
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
});
