describe('Game Build Multi-Tab Synchronization', () => {
  const gameId = 'test-game-123';
  const baseUrl = 'http://localhost:5173';

  beforeEach(() => {
    // Mock API responses
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

  it('should synchronize question selection across multiple tabs', () => {
    // Open first tab
    cy.visit(`${baseUrl}/game/${gameId}/build`);
    cy.wait('@getManifest');

    // Verify initial state
    cy.get('[data-testid="question-card"]').should('have.length', 1);
    cy.get('[data-testid="selected-count"]').should('contain', '0');

    // Select a question in first tab
    cy.get('[data-testid="question-card"]').first().click();
    cy.get('[data-testid="selected-count"]').should('contain', '1');

    // Open second tab
    cy.window().then((win) => {
      win.open(`${baseUrl}/game/${gameId}/build`, '_blank');
    });

    // Switch to second tab
    cy.window().then((win) => {
      win.focus();
    });

    // Verify second tab shows the same selection
    cy.get('[data-testid="question-card"]').first().should('have.class', 'selected');
    cy.get('[data-testid="selected-count"]').should('contain', '1');

    // Select another question in second tab
    cy.get('[data-testid="question-card"]').eq(1).click();
    cy.get('[data-testid="selected-count"]').should('contain', '2');

    // Switch back to first tab
    cy.window().then((win) => {
      win.focus();
    });

    // Verify first tab shows updated selection
    cy.get('[data-testid="selected-count"]').should('contain', '2');
  });

  it('should synchronize custom question creation across tabs', () => {
    // Open first tab
    cy.visit(`${baseUrl}/game/${gameId}/build`);
    cy.wait('@getManifest');

    // Switch to Write Custom tab
    cy.get('[data-testid="write-tab"]').click();

    // Create custom question
    cy.get('[data-testid="write-custom-button"]').click();
    cy.get('[data-testid="question-input"]').type('Test custom question');
    cy.get('[data-testid="type-select"]').click();
    cy.get('[data-testid="type-option-trivia"]').click();
    cy.get('[data-testid="category-input"]').type('test');
    cy.get('[data-testid="submit-question"]').click();

    cy.wait('@createCustomQuestion');

    // Verify custom question appears
    cy.get('[data-testid="custom-question"]').should('have.length', 1);

    // Open second tab
    cy.window().then((win) => {
      win.open(`${baseUrl}/game/${gameId}/build`, '_blank');
    });

    // Switch to second tab and verify custom question appears
    cy.window().then((win) => {
      win.focus();
    });

    cy.get('[data-testid="write-tab"]').click();
    cy.get('[data-testid="custom-question"]').should('have.length', 1);
    cy.get('[data-testid="custom-question"]').should('contain', 'Test custom question');
  });

  it('should auto-start round when all players have questions', () => {
    // Mock manifest with all players having questions
    cy.intercept('GET', `/api/games/${gameId}/manifest`, {
      statusCode: 200,
      body: {
        id: gameId,
        name: 'Test Game',
        code: 'TEST123',
        status: 'playing',
        type: 'would_you_rather',
        maxPlayers: 2,
        currentPlayers: 2,
        roundsPerGame: 2,
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
            question: 'Question 1',
            type: 'would_you_rather',
            category: 'fun',
            roundNumber: 1,
            createdBy: 'player1',
          },
          {
            id: 'q2',
            question: 'Question 2',
            type: 'trivia',
            category: 'test',
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
    }).as('getManifestWithAllQuestions');

    // Open first tab
    cy.visit(`${baseUrl}/game/${gameId}/build`);
    cy.wait('@getManifestWithAllQuestions');

    // Verify "All Ready" badge appears
    cy.get('[data-testid="all-ready-badge"]').should('be.visible');

    // Wait for auto-start round call
    cy.wait('@startRound');

    // Verify round start was called
    cy.get('@startRound.all').should('have.length', 1);
  });

  it('should handle polling errors gracefully', () => {
    // Mock manifest endpoint to fail
    cy.intercept('GET', `/api/games/${gameId}/manifest`, {
      statusCode: 500,
      body: { error: 'Internal server error' },
    }).as('getManifestError');

    // Open page
    cy.visit(`${baseUrl}/game/${gameId}/build`);
    cy.wait('@getManifestError');

    // Verify error message is displayed
    cy.get('[data-testid="polling-error"]').should('be.visible');
    cy.get('[data-testid="polling-error"]').should('contain', 'Connection Error');

    // Verify offline indicator
    cy.get('[data-testid="polling-status"]').should('contain', 'Offline');
  });

  it('should maintain state during tab switching', () => {
    // Open first tab
    cy.visit(`${baseUrl}/game/${gameId}/build`);
    cy.wait('@getManifest');

    // Select questions and create custom question
    cy.get('[data-testid="question-card"]').first().click();
    cy.get('[data-testid="write-tab"]').click();
    cy.get('[data-testid="write-custom-button"]').click();
    cy.get('[data-testid="question-input"]').type('Tab sync test question');
    cy.get('[data-testid="type-select"]').click();
    cy.get('[data-testid="type-option-trivia"]').click();
    cy.get('[data-testid="category-input"]').type('sync-test');
    cy.get('[data-testid="submit-question"]').click();

    cy.wait('@createCustomQuestion');

    // Switch to suggestions tab
    cy.get('[data-testid="suggestions-tab"]').click();

    // Open second tab
    cy.window().then((win) => {
      win.open(`${baseUrl}/game/${gameId}/build`, '_blank');
    });

    // Switch to second tab
    cy.window().then((win) => {
      win.focus();
    });

    // Verify state is synchronized
    cy.get('[data-testid="selected-count"]').should('contain', '1');
    cy.get('[data-testid="write-tab"]').click();
    cy.get('[data-testid="custom-question"]').should('contain', 'Tab sync test question');

    // Switch back to first tab
    cy.window().then((win) => {
      win.focus();
    });

    // Verify state is maintained
    cy.get('[data-testid="selected-count"]').should('contain', '1');
    cy.get('[data-testid="write-tab"]').click();
    cy.get('[data-testid="custom-question"]').should('contain', 'Tab sync test question');
  });

  it('should handle rapid state changes across tabs', () => {
    // Open first tab
    cy.visit(`${baseUrl}/game/${gameId}/build`);
    cy.wait('@getManifest');

    // Open second tab
    cy.window().then((win) => {
      win.open(`${baseUrl}/game/${gameId}/build`, '_blank');
    });

    // Rapidly select/deselect questions in first tab
    cy.window().then((win) => {
      win.focus();
    });

    for (let i = 0; i < 5; i++) {
      cy.get('[data-testid="question-card"]').first().click();
      cy.wait(100);
      cy.get('[data-testid="question-card"]').first().click();
      cy.wait(100);
    }

    // Switch to second tab and verify final state
    cy.window().then((win) => {
      win.focus();
    });

    // Should show consistent state
    cy.get('[data-testid="question-card"]').first().should('not.have.class', 'selected');
  });

  it('should handle network interruptions gracefully', () => {
    // Open page
    cy.visit(`${baseUrl}/game/${gameId}/build`);
    cy.wait('@getManifest');

    // Simulate network interruption
    cy.intercept('GET', `/api/games/${gameId}/manifest`, {
      forceNetworkError: true,
    }).as('getManifestNetworkError');

    // Wait for error
    cy.wait('@getManifestNetworkError');

    // Verify error handling
    cy.get('[data-testid="polling-error"]').should('be.visible');

    // Restore network
    cy.intercept('GET', `/api/games/${gameId}/manifest`, {
      statusCode: 200,
      body: {
        id: gameId,
        name: 'Test Game',
        code: 'TEST123',
        status: 'playing',
        type: 'would_you_rather',
        maxPlayers: 2,
        currentPlayers: 2,
        roundsPerGame: 2,
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
        ],
        queuedQuestions: [],
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
    }).as('getManifestRestored');

    // Wait for recovery
    cy.wait('@getManifestRestored');

    // Verify recovery
    cy.get('[data-testid="polling-error"]').should('not.exist');
    cy.get('[data-testid="polling-status"]').should('contain', 'Live');
  });
}); 