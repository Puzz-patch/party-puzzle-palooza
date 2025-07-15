// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })

// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })

// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })

// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

// Custom command to create a test game
Cypress.Commands.add('createTestGame', (gameId: string) => {
  cy.intercept('GET', `/api/games/${gameId}/manifest`, {
    statusCode: 200,
    body: {
      id: gameId,
      name: 'Test Game',
      code: 'TEST123',
      status: 'playing',
      type: 'would_you_rather',
      maxPlayers: 4,
      currentPlayers: 2,
      roundsPerGame: 3,
      timePerRound: 30,
      players: [
        {
          id: 'player1',
          username: 'player1',
          firstName: 'John',
          lastName: 'Doe',
          score: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          isHost: true,
          isSpectator: false,
          joinedAt: new Date().toISOString(),
        },
        {
          id: 'player2',
          username: 'player2',
          firstName: 'Jane',
          lastName: 'Smith',
          score: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          isHost: false,
          isSpectator: false,
          joinedAt: new Date().toISOString(),
        },
      ],
      queuedQuestions: [
        {
          id: 'q1',
          question: 'Would you rather have the ability to fly or be invisible?',
          type: 'would_you_rather',
          category: 'fun',
          roundNumber: 1,
          createdBy: 'player1',
        },
        {
          id: 'q2',
          question: 'What is the capital of France?',
          type: 'trivia',
          category: 'geography',
          roundNumber: 2,
          createdBy: 'player2',
        },
      ],
      flags: {
        isPrivate: false,
        hasPassword: false,
        isStarted: true,
        isFinished: false,
        isFull: false,
      },
      createdAt: new Date().toISOString(),
      currentState: 'question_build',
    },
  }).as('getManifest');
});

// Custom command to mock API endpoints
Cypress.Commands.add('mockApiEndpoints', (gameId: string) => {
  cy.intercept('POST', `/api/games/${gameId}/questions/custom`, {
    statusCode: 201,
    body: {
      id: 'custom-q1',
      question: 'Test custom question',
      type: 'trivia',
      category: 'test',
      gameId,
      createdBy: 'player2',
      status: 'pending',
    },
  }).as('createCustomQuestion');

  cy.intercept('POST', `/api/games/${gameId}/rounds/start`, {
    statusCode: 200,
    body: { success: true, message: 'Round started' },
  }).as('startRound');
});

// Custom command to wait for network idle
Cypress.Commands.add('waitForNetworkIdle', (timeout = 1000) => {
  cy.wait(timeout);
});

// Custom command to check if element is visible and not disabled
Cypress.Commands.add('shouldBeEnabled', { prevSubject: 'element' }, (subject) => {
  cy.wrap(subject).should('be.visible').should('not.be.disabled');
});

// Custom command to check if element has specific class
Cypress.Commands.add('shouldHaveClass', { prevSubject: 'element' }, (subject, className) => {
  cy.wrap(subject).should('have.class', className);
});

// Custom command to check if element contains text
Cypress.Commands.add('shouldContainText', { prevSubject: 'element' }, (subject, text) => {
  cy.wrap(subject).should('contain.text', text);
}); 