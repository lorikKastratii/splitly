import { Expense, Settlement, Balance, SimplifiedDebt, User } from '../types';

export const calculateSplits = (
  amount: number,
  members: User[],
  splitType: 'equal' | 'percentage' | 'exact',
  customSplits?: { userId: string; amount?: number; percentage?: number }[]
) => {
  if (splitType === 'equal') {
    const perPerson = amount / members.length;
    return members.map((member) => ({
      userId: member.id,
      amount: perPerson,
    }));
  }

  if (splitType === 'percentage' && customSplits) {
    return customSplits.map((split) => ({
      userId: split.userId,
      amount: (amount * (split.percentage || 0)) / 100,
      percentage: split.percentage,
    }));
  }

  if (splitType === 'exact' && customSplits) {
    return customSplits.map((split) => ({
      userId: split.userId,
      amount: split.amount || 0,
    }));
  }

  return [];
};

export const calculateBalances = (
  expenses: Expense[],
  members: User[],
  settlements: Settlement[] = []
): Balance[] => {
  const balances: Record<string, number> = {};

  members.forEach((member) => {
    balances[member.id] = 0;
  });

  // Add expenses: payer gets credit, participants get debited
  expenses.forEach((expense) => {
    balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;

    expense.splits.forEach((split) => {
      balances[split.userId] = (balances[split.userId] || 0) - split.amount;
    });
  });

  // Apply settlements: from gets credit (paid off debt), to gets debited (received payment)
  settlements.forEach((settlement) => {
    balances[settlement.from] = (balances[settlement.from] || 0) + settlement.amount;
    balances[settlement.to] = (balances[settlement.to] || 0) - settlement.amount;
  });

  return Object.entries(balances).map(([userId, amount]) => ({
    userId,
    amount,
  }));
};

export const simplifyDebts = (balances: Balance[]): SimplifiedDebt[] => {
  const debts: SimplifiedDebt[] = [];
  // Clone the balances to avoid mutating the original array
  const creditors = balances
    .filter((b) => b.amount > 0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.amount < -0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.amount - b.amount);

  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const amount = Math.min(creditor.amount, Math.abs(debtor.amount));

    if (amount > 0.01) {
      debts.push({
        from: debtor.userId,
        to: creditor.userId,
        amount,
      });
    }

    creditor.amount -= amount;
    debtor.amount += amount;

    if (creditor.amount < 0.01) i++;
    if (debtor.amount > -0.01) j++;
  }

  return debts;
};
