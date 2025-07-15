# Token Integrity Tests

## Overview

This document describes comprehensive Jest tests that ensure no action allows player tokens to go below 0, covering overspend scenarios and ledger integrity across all services.

## Test Coverage

### 🎯 **Core Requirements**

1. **No Negative Balances**: Player tokens can never go below 0
2. **Overspend Prevention**: All actions validate sufficient balance before execution
3. **Ledger Integrity**: All transactions are accurately recorded
4. **Chill Mode Respect**: Chill mode bypasses token deduction
5. **Action Independence**: Player actions don't affect token balances

### 📊 **Test Categories**

#### **1. Shot Service Tests (`shot.service.test.ts`)**

**Overspend Prevention Tests:**
- `should prevent shot when bet amount exceeds balance`
- `should prevent shot when bet amount equals balance exactly`
- `should prevent shot when bet amount is greater than balance by 1`
- `should allow shot when bet amount is less than balance`

**Edge Case Tests:**
- `should handle zero balance correctly`
- `should handle negative balance (should not happen but test anyway)`
- `should handle very large bet amounts`

**Chill Mode Tests:**
- `should not deduct tokens in chill mode regardless of balance`
- `should create transaction with zero amount in chill mode`

**Ledger Integrity Tests:**
- `should create accurate transaction ledger entry`
- `should update user balance correctly`
- `should handle transaction rollback on balance update failure`
- `should handle transaction rollback on ledger creation failure`
- `should ensure balance never goes below zero in transaction`

**Concurrency Tests:**
- `should handle concurrent shot attempts correctly`
- `should prevent double-spending through row locks`

#### **2. Player Action Service Tests (`player-action.service.test.ts`)**

**Token Independence Tests:**
- `should not affect token balances for roll action`
- `should not affect token balances for force action`
- `should not affect token balances for shield action`

**Validation Tests:**
- `should validate actions without checking token balances`
- `should not query user balance for any action`

**Transaction Integrity Tests:**
- `should rollback on round data update failure`
- `should handle coin-flip randomness consistently`

#### **3. Integration Tests (`token-integrity.integration.test.ts`)**

**Cross-Service Tests:**
- `should maintain token integrity when shot is taken then action is performed`
- `should prevent overspend when shot is taken after action`
- `should maintain ledger integrity across multiple operations`

**Edge Case Scenarios:**
- `should handle zero balance correctly across services`
- `should handle exact balance scenarios`
- `should handle chill mode across services`

**Concurrency Tests:**
- `should prevent race conditions in token deduction`
- `should maintain action integrity without affecting tokens`

## Test Execution

### Running All Tests

```bash
# Run the comprehensive test suite
./scripts/run-token-tests.sh
```

### Running Individual Test Suites

```bash
# Shot service tests
npm test -- --testPathPattern="shot.service.test.ts"

# Player action service tests
npm test -- --testPathPattern="player-action.service.test.ts"

# Integration tests
npm test -- --testPathPattern="token-integrity.integration.test.ts"
```

### Running Specific Test Patterns

```bash
# Test overspend prevention
npm test -- --testNamePattern="should prevent shot when bet amount exceeds balance"

# Test zero balance handling
npm test -- --testNamePattern="should handle zero balance correctly"

# Test ledger integrity
npm test -- --testNamePattern="should create accurate transaction ledger entry"

# Test action token independence
npm test -- --testNamePattern="should not affect token balances for roll action"
```

## Test Scenarios

### 🚫 **Overspend Prevention**

```typescript
// Test: Player with 3 tokens tries to bet 5 tokens
const poorBalance = { balance: 3 };
await expect(
  shotService.takeShot('round-1', 'player-1', 'game-1', { 
    answer: 'Fly', 
    betAmount: 5 
  })
).rejects.toThrow(BadRequestException);
```

**Expected Result:**
- ❌ Shot fails with `BadRequestException`
- ❌ No tokens deducted
- ❌ Transaction rolled back
- ❌ Balance remains 3

### ✅ **Valid Shot Scenarios**

```typescript
// Test: Player with 10 tokens bets 5 tokens
const balance = { balance: 10 };
const result = await shotService.takeShot('round-1', 'player-1', 'game-1', { 
  answer: 'Fly', 
  betAmount: 5 
});

expect(result.balanceBefore).toBe(10);
expect(result.balanceAfter).toBe(5);
expect(result.betAmount).toBe(5);
```

**Expected Result:**
- ✅ Shot succeeds
- ✅ 5 tokens deducted
- ✅ Balance updated to 5
- ✅ Transaction committed
- ✅ Ledger entry created

### 😌 **Chill Mode Scenarios**

```typescript
// Test: Player bets 1000 tokens in chill mode
const chillGame = { settings: { chill_mode: true } };
const result = await shotService.takeShot('round-1', 'player-1', 'game-1', { 
  answer: 'Fly', 
  betAmount: 1000 
});

expect(result.isChillMode).toBe(true);
expect(result.betAmount).toBe(0);
expect(result.balanceBefore).toBe(100);
expect(result.balanceAfter).toBe(100);
```

**Expected Result:**
- ✅ Shot succeeds
- ✅ 0 tokens deducted
- ✅ Balance unchanged
- ✅ Transaction with zero amount

### 🎲 **Action Independence**

```typescript
// Test: Player performs action regardless of token balance
const actionResult = await playerActionService.performAction('round-1', 'player-1', 'game-1', {
  actionType: PlayerActionType.ROLL
});

expect(actionResult.success).toBeDefined();
expect(actionResult.result).toMatch(/heads|tails/);
```

**Expected Result:**
- ✅ Action succeeds
- ✅ No token operations performed
- ✅ No balance queries made
- ✅ Only round data updated

## Database Integrity

### Transaction Ledger Validation

```typescript
// Verify accurate ledger entry creation
expect(queryRunner.manager.create).toHaveBeenCalledWith(TransactionLedger, {
  userId: 'player-1',
  gameRoundId: 'round-1',
  transactionType: TransactionType.SHOT,
  amount: -5, // Negative for debit
  balanceBefore: 100,
  balanceAfter: 95,
  status: TransactionStatus.COMPLETED,
  reference: 'shot_round-1_player-1'
});
```

### Balance Update Validation

```typescript
// Verify accurate balance update
expect(queryRunner.manager.update).toHaveBeenCalledWith(UserBalance, 'balance-1', {
  balance: 95,
  totalSpent: 55, // Previous 50 + new 5
  lastUpdatedAt: expect.any(Date)
});
```

## Concurrency Handling

### Row-Level Locking

```typescript
// Verify pessimistic write lock is used
expect(queryRunner.manager.createQueryBuilder().setLock)
  .toHaveBeenCalledWith('pessimistic_write');
```

### Race Condition Prevention

```typescript
// Test: Multiple concurrent shots
const shot1 = shotService.takeShot('round-1', 'player-1', 'game-1', { betAmount: 60 });
const shot2 = shotService.takeShot('round-1', 'player-1', 'game-1', { betAmount: 30 });
const shot3 = shotService.takeShot('round-1', 'player-1', 'game-1', { betAmount: 20 });

// Results: shot1 (60) + shot2 (30) = 90, shot3 should fail
expect(shot1.balanceAfter).toBe(40);
expect(shot2.balanceAfter).toBe(10);
expect(shot3).rejects.toThrow(BadRequestException);
```

## Error Handling

### Rollback Scenarios

```typescript
// Test: Database error during balance update
queryRunner.manager.update.mockRejectedValue(new Error('Database error'));

await expect(
  shotService.takeShot('round-1', 'player-1', 'game-1', takeShotDto)
).rejects.toThrow('Database error');

expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
```

### Validation Failures

```typescript
// Test: Insufficient balance
await expect(
  shotService.takeShot('round-1', 'player-1', 'game-1', { 
    answer: 'Fly', 
    betAmount: 1000 
  })
).rejects.toThrow(BadRequestException);

// Verify no balance update was attempted
expect(queryRunner.manager.update).not.toHaveBeenCalled();
```

## Performance Considerations

### Test Execution Time

- **Unit Tests**: ~2-3 seconds
- **Integration Tests**: ~5-8 seconds
- **Full Suite**: ~10-15 seconds

### Database Operations

- **Row-Level Locking**: Prevents race conditions
- **Atomic Transactions**: Ensures data consistency
- **Efficient Queries**: Optimized balance lookups

## Continuous Integration

### GitHub Actions Integration

```yaml
- name: Run Token Integrity Tests
  run: |
    cd apps/api
    ./scripts/run-token-tests.sh
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:token-integrity"
    }
  }
}
```

## Monitoring and Alerts

### Test Failure Alerts

- **Overspend Prevention**: Critical - Immediate alert
- **Ledger Integrity**: Critical - Immediate alert
- **Action Independence**: High - Alert within 1 hour
- **Chill Mode**: Medium - Alert within 4 hours

### Metrics Tracking

- **Test Coverage**: >95% for token-related code
- **Test Execution Time**: <15 seconds for full suite
- **Failure Rate**: <1% for token integrity tests

## Future Enhancements

### Additional Test Scenarios

1. **Multi-Player Concurrency**: Test simultaneous shots from different players
2. **Network Partitioning**: Test behavior during connection issues
3. **Database Failover**: Test behavior during database failover
4. **Load Testing**: Test with high concurrent user load

### Performance Optimizations

1. **Parallel Test Execution**: Run independent tests in parallel
2. **Database Fixtures**: Pre-populate test data for faster execution
3. **Mock Optimization**: Reduce mock setup overhead

This comprehensive test suite ensures that the token system maintains integrity under all scenarios, preventing any possibility of negative balances or overspending. 