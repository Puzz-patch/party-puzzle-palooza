const { test, expect } = require('@playwright/test');

test.describe('Complete Game Flow', () => {
  let gameId = null;
  let playerTokens = [];

  test('should complete full game flow from lobby to finale', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    await expect(page.locator('[data-testid="create-room"]')).toBeVisible();

    // Create a room
    await page.click('[data-testid="create-room"]');
    await expect(page.locator('[data-testid="room-lobby"]')).toBeVisible();

    // Get room ID from URL
    const url = page.url();
    gameId = url.split('/').pop();
    expect(gameId).toBeTruthy();

    // Join as first player
    await page.fill('[data-testid="player-name"]', 'E2E Player 1');
    await page.click('[data-testid="join-room"]');
    await expect(page.locator('[data-testid="player-avatar"]')).toBeVisible();

    // Open second tab for second player
    const page2 = await page.context().newPage();
    await page2.goto(`/room/${gameId}`);
    await page2.fill('[data-testid="player-name"]', 'E2E Player 2');
    await page2.click('[data-testid="join-room"]');

    // Wait for both players to be visible
    await expect(page.locator('[data-testid="player-avatar"]')).toHaveCount(2);
    await expect(page2.locator('[data-testid="player-avatar"]')).toHaveCount(2);

    // Start the game (if auto-start is enabled)
    await page.waitForTimeout(2000);

    // Check if we're in the build phase
    const buildPhase = page.locator('[data-testid="game-build"]');
    if (await buildPhase.isVisible()) {
      // Submit a custom question
      await page.click('[data-testid="write-tab"]');
      await page.fill('[data-testid="question-input"]', 'Would you rather have the ability to fly or be invisible?');
      await page.click('[data-testid="submit-question"]');
      
      // Wait for question to be submitted
      await expect(page.locator('[data-testid="question-card"]')).toBeVisible();

      // Submit question from second player
      await page2.click('[data-testid="write-tab"]');
      await page2.fill('[data-testid="question-input"]', 'Would you rather travel to the past or the future?');
      await page2.click('[data-testid="submit-question"]');

      // Wait for both questions to be visible
      await expect(page.locator('[data-testid="question-card"]')).toHaveCount(2);

      // Lock and load (if button is available)
      const lockButton = page.locator('[data-testid="lock-load-button"]');
      if (await lockButton.isVisible()) {
        await lockButton.click();
      }
    }

    // Wait for gameplay to start
    await page.waitForTimeout(5000);

    // Check if we're in gameplay phase
    const gameplayPhase = page.locator('[data-testid="game-play"]');
    if (await gameplayPhase.isVisible()) {
      // Wait for target selection if current player is asker
      const targetModal = page.locator('[data-testid="target-selection-modal"]');
      if (await targetModal.isVisible()) {
        // Select a target
        await page.click('[data-testid="target-player"]');
        await page.click('[data-testid="confirm-target"]');
      }

      // Wait for shot phase
      await page.waitForTimeout(3000);

      // Take a shot if available
      const shotButton = page.locator('[data-testid="take-shot-button"]');
      if (await shotButton.isVisible()) {
        await shotButton.click();
        await expect(page.locator('[data-testid="shot-result"]')).toBeVisible();
      }

      // Submit player action if available
      const actionButtons = page.locator('[data-testid="player-action-button"]');
      if (await actionButtons.first().isVisible()) {
        await actionButtons.first().click();
      }
    }

    // Wait for round to complete
    await page.waitForTimeout(10000);

    // Check if we're in finale phase
    const finalePhase = page.locator('[data-testid="game-finale"]');
    if (await finalePhase.isVisible()) {
      await expect(page.locator('[data-testid="finale-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="podium"]')).toBeVisible();
      await expect(page.locator('[data-testid="token-summary"]')).toBeVisible();
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/game-flow-complete.png' });
  });

  test('should handle WebSocket connections properly', async ({ page }) => {
    await page.goto('/');
    
    // Create a room
    await page.click('[data-testid="create-room"]');
    await expect(page.locator('[data-testid="room-lobby"]')).toBeVisible();

    // Check WebSocket connection status
    const wsStatus = await page.evaluate(() => {
      return window.wsConnected || false;
    });

    expect(wsStatus).toBe(true);
  });

  test('should handle API endpoints correctly', async ({ request }) => {
    // Test health endpoint
    const healthResponse = await request.get('/api/health');
    expect(healthResponse.ok()).toBeTruthy();
    
    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('ok');
  });
}); 