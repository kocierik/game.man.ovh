import { expect, test } from "@playwright/test";

async function createHostRoom(page, { name = "Host", language = "it" } = {}) {
  await page.goto("/");
  await page.getByLabel("Lingua della stanza").selectOption(language);
  await page.getByLabel(language === "it" ? "Il tuo nome" : "Your name").fill(name);
  await page.getByRole("button", { name: language === "it" ? "Crea stanza" : "Create room" }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}\/host$/);
  return (await page.getByTestId("room-code").textContent()).trim();
}

async function joinPlayer(page, roomCode, name) {
  await page.goto(`/room/${roomCode}/join`);
  await page.getByLabel("Il tuo nome").fill(name);
  await page.getByRole("button", { name: "Entra nella stanza" }).click();
  await expect(page).toHaveURL(new RegExp(`/room/${roomCode}/play$`));
}

test("host creates an Italian room with a share code and QR", async ({ page }) => {
  const roomCode = await createHostRoom(page);

  await expect(page.getByTestId("room-code")).toHaveText(roomCode);
  await expect(page.getByRole("heading", { name: "In attesa dei giocatori" })).toBeVisible();
  await expect(page.getByTestId("join-qr")).toBeVisible();
});

test("players vote privately, host reveals, and queued questions become the next prompt", async ({ page }) => {
  const roomCode = await createHostRoom(page);
  const alex = await page.context().newPage();
  const sam = await page.context().newPage();
  await joinPlayer(alex, roomCode, "Alex");
  await joinPlayer(sam, roomCode, "Sam");

  await expect(page.getByTestId("player-count")).toHaveText("3");
  await page.getByRole("button", { name: "Inizia il round" }).click();
  await expect(alex.getByTestId("current-prompt")).toBeVisible();

  await alex.getByRole("button", { name: "Host", exact: true }).click();
  await sam.getByRole("button", { name: "Host", exact: true }).click();
  await alex.getByLabel("Aggiungi una domanda").fill("Chi farebbe amicizia con un alieno?");
  await alex.getByRole("button", { name: "Invia domanda" }).click();
  await expect(page.getByTestId("queued-count")).toContainText("1");

  await expect(alex.getByTestId("results-panel")).toBeHidden();
  await page.getByRole("button", { name: "Mostra i risultati" }).click();
  await expect(alex.getByTestId("results-panel")).toBeVisible();
  await expect(alex.getByTestId("results-panel")).toContainText("Host");

  await page.getByRole("button", { name: "Prossimo round" }).click();
  await expect(alex.getByTestId("current-prompt")).toHaveText("Chi farebbe amicizia con un alieno?");
  await expect(sam.getByTestId("current-prompt")).toHaveText("Chi farebbe amicizia con un alieno?");
});

test("host can choose English for a room", async ({ page }) => {
  const roomCode = await createHostRoom(page, { language: "en" });

  await expect(page.getByRole("heading", { name: "Waiting for players" })).toBeVisible();
  await page.getByRole("button", { name: "Start round" }).click();
  await expect(page.getByTestId("current-prompt")).toContainText("Who");
  await expect(page.getByTestId("room-code")).toHaveText(roomCode);
});

test("phone players can join and vote without horizontal overflow", async ({ page }) => {
  const roomCode = await createHostRoom(page);
  const phone = await page.context().newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await joinPlayer(phone, roomCode, "Phone player");
  await page.getByRole("button", { name: "Inizia il round" }).click();

  const documentWidth = await phone.evaluate("document.documentElement.scrollWidth");
  expect(documentWidth).toBeLessThanOrEqual(390);
  await expect(phone.getByTestId("current-prompt")).toBeVisible();
  const voteOption = phone.getByRole("button", { name: "Host", exact: true });
  const optionSize = await voteOption.boundingBox();
  expect(optionSize?.height).toBeGreaterThanOrEqual(50);
  await voteOption.click();
  await expect(phone.getByText("Voto registrato. Puoi cambiarlo fino al reveal.")).toBeVisible();
});
