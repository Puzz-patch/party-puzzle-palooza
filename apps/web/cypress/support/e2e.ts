// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Add global error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from
  // failing the test on uncaught exceptions
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  return true;
});

// Add custom commands for common operations
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to wait for polling to complete
       * @example cy.waitForPolling()
       */
      waitForPolling(): Chainable<void>;
      
      /**
       * Custom command to wait for manifest to load
       * @example cy.waitForManifest()
       */
      waitForManifest(): Chainable<void>;
      
      /**
       * Custom command to switch to a new tab
       * @example cy.switchToNewTab()
       */
      switchToNewTab(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('waitForPolling', () => {
  cy.get('[data-testid="polling-status"]').should('contain', 'Live');
});

Cypress.Commands.add('waitForManifest', () => {
  cy.wait('@getManifest');
  cy.get('[data-testid="selected-count"]').should('be.visible');
});

Cypress.Commands.add('switchToNewTab', () => {
  cy.window().then((win) => {
    win.focus();
  });
}); 