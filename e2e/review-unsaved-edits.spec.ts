import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// S-90: NeedsReviewRow/MatchedLineRow/NewItemRow in review-detail.tsx hold
// their edit fields in local useState with no dirty-tracking. "Skip to
// next" (SessionCounter) and the mobile back link were plain Links, so an
// edited-but-unsaved field was silently discarded on navigation with zero
// warning. These tests seed a two-receipt session (the `session` search
// param review-detail.tsx's page.tsx parses into { position, total, nextId,
// allIds }) directly via a service-role client, following the exact
// signup/seed pattern review-states.spec.ts already uses for this route.

const TEST_PASSWORD = "E2eTestPassword123!";

function uniqueTestEmail(tag: string): string {
  return `e2e-review-unsaved-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-test.dev`;
}

async function signUpAndOnboard(page: Page, tag: string): Promise<string> {
  const email = uniqueTestEmail(tag);

  await page.goto("/signup");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator("#confirmPassword").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /create household/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/onboarding"), {
    timeout: 15_000,
  });

  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /^skip$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/onboarding"));

  return email;
}

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set for this fixture",
    );
  return createClient(url, key);
}

async function householdIdForEmail(email: string): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey)
    throw new Error(
      "SUPABASE_URL / SUPABASE_ANON_KEY must be set for this fixture",
    );

  const client = createClient(url, anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError) throw signInError;

  const { data, error } = await client
    .from("household_members")
    .select("household_id")
    .single();
  if (error || !data)
    throw error ?? new Error("no household_members row for " + email);
  return data.household_id;
}

async function seedParsedReceipt(
  admin: ReturnType<typeof serviceClient>,
  householdId: string,
): Promise<string> {
  const { data: receipt, error } = await admin
    .from("receipts")
    .insert({
      household_id: householdId,
      status: "parsed",
      storage_paths: [],
      purchased_at: new Date().toISOString(),
      purchased_at_confirmed: true,
    })
    .select("id")
    .single();
  if (error || !receipt) throw error;
  return receipt.id;
}

test('review detail: an unsaved edit prompts before "Skip to next" discards it, and a clean row skips silently', async ({
  page,
}) => {
  const email = await signUpAndOnboard(page, "skip");
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin
    .from("categories")
    .select("slug")
    .not("parent_id", "is", null)
    .limit(1)
    .single();
  if (categoryError || !category) throw categoryError;

  const receiptAId = await seedParsedReceipt(admin, householdId);
  const receiptBId = await seedParsedReceipt(admin, householdId);

  const { error: lineError } = await admin.from("receipt_lines").insert({
    household_id: householdId,
    receipt_id: receiptAId,
    line_no: 1,
    raw_text: "S-90 fixture item",
    item_name: "S-90 fixture item",
    category_slug: category.slug,
    review_state: "needs_review",
  });
  if (lineError) throw lineError;

  await page.goto(`/review/${receiptAId}?session=${receiptAId},${receiptBId}`);
  const skipLink = page.getByRole("link", { name: "Skip to next" });
  await expect(skipLink).toBeVisible();

  // Single persistent dialog listener for the whole test, driven by
  // `pendingAction`, instead of re-registering page.once() per click.
  // window.confirm() blocks the page's JS thread until the dialog is
  // resolved, so a listener that isn't already attached and awaited before
  // the click resolves races the dialog -- a persistent page.on() handler
  // with an awaited dismiss()/accept() avoids that regardless of exactly
  // when Playwright delivers the 'dialog' event relative to click()
  // settling.
  let pendingAction: "dismiss" | "accept" | null = null;
  let sawDialog = false;
  page.on("dialog", async (dialog) => {
    sawDialog = true;
    if (pendingAction === "accept") await dialog.accept();
    else await dialog.dismiss();
  });

  // Clean state: no edits made yet -- "Skip to next" must navigate
  // immediately, no dialog, no added friction on the common case.
  await skipLink.click();
  await page.waitForURL((url) => url.pathname === `/review/${receiptBId}`, {
    timeout: 10_000,
  });
  expect(sawDialog).toBe(false);

  // Back to receipt A, this time make an unsaved edit.
  await page.goto(`/review/${receiptAId}?session=${receiptAId},${receiptBId}`);
  const itemNameInput = page.getByLabel("Item name");
  await itemNameInput.fill("S-90 fixture item EDITED");

  // Dismiss (cancel) -- must stay on the same receipt, edit preserved.
  sawDialog = false;
  pendingAction = "dismiss";
  await skipLink.click();
  await expect.poll(() => sawDialog, { timeout: 5_000 }).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/review/${receiptAId}(\\?|$)`));
  await expect(itemNameInput).toHaveValue("S-90 fixture item EDITED");

  // Accept -- navigation proceeds, edit is discarded as the user chose.
  sawDialog = false;
  pendingAction = "accept";
  await skipLink.click();
  await page.waitForURL((url) => url.pathname === `/review/${receiptBId}`, {
    timeout: 10_000,
  });

  await admin.from("receipts").delete().eq("id", receiptAId);
  await admin.from("receipts").delete().eq("id", receiptBId);
});

test("review detail: an unsaved edit prompts before the mobile back link discards it", async ({
  page,
}) => {
  const email = await signUpAndOnboard(page, "back");
  const householdId = await householdIdForEmail(email);
  const admin = serviceClient();

  const { data: category, error: categoryError } = await admin
    .from("categories")
    .select("slug")
    .not("parent_id", "is", null)
    .limit(1)
    .single();
  if (categoryError || !category) throw categoryError;

  const receiptId = await seedParsedReceipt(admin, householdId);

  const { error: lineError } = await admin.from("receipt_lines").insert({
    household_id: householdId,
    receipt_id: receiptId,
    line_no: 1,
    raw_text: "S-90 back-nav fixture item",
    item_name: "S-90 back-nav fixture item",
    category_slug: category.slug,
    review_state: "needs_review",
  });
  if (lineError) throw lineError;

  // Playwright config's default project is iPhone 13's viewport (see
  // playwright.config.ts) -- MobileTopBar's back link is already visible
  // without forcing a viewport here.
  await page.goto(`/review/${receiptId}`);

  const itemNameInput = page.getByLabel("Item name");
  await itemNameInput.fill("S-90 back-nav fixture item EDITED");

  const backLink = page.getByRole("link", { name: "Back" });

  let pendingAction: "dismiss" | "accept" | null = null;
  let sawDialog = false;
  page.on("dialog", async (dialog) => {
    sawDialog = true;
    if (pendingAction === "accept") await dialog.accept();
    else await dialog.dismiss();
  });

  pendingAction = "dismiss";
  await backLink.click();
  await expect.poll(() => sawDialog, { timeout: 5_000 }).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/review/${receiptId}(\\?|$)`));
  await expect(itemNameInput).toHaveValue("S-90 back-nav fixture item EDITED");

  sawDialog = false;
  pendingAction = "accept";
  await backLink.click();
  await page.waitForURL((url) => url.pathname === "/review", {
    timeout: 10_000,
  });

  await admin.from("receipts").delete().eq("id", receiptId);
});
