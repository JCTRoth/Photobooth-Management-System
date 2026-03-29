export type StrengthTone = 'empty' | 'weak' | 'fair' | 'good' | 'strong';
export type RuleState = 'pending' | 'missing' | 'met';

export interface PasswordStrength {
  tone: StrengthTone;
  label: string;
  description: string;
  activeBars: number;
}

function joinSuggestions(parts: string[]) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function getRuleState(active: boolean, satisfied: boolean): RuleState {
  if (!active) return 'pending';
  return satisfied ? 'met' : 'missing';
}

export function evaluatePasswordStrength(password: string, currentPassword: string): PasswordStrength {
  if (!password) {
    return {
      tone: 'empty',
      label: 'Waiting',
      description: 'Start with a long phrase or sentence-style password, then layer in numbers and symbols.',
      activeBars: 0,
    };
  }

  const hasMinLength = password.length >= 12;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
  const hasNoWhitespace = !/\s/.test(password);
  const differsFromCurrent = !currentPassword || password !== currentPassword;
  const isLong = password.length >= 16;

  let score = 0;
  if (hasMinLength) score += 2;
  if (hasLower) score += 1;
  if (hasUpper) score += 1;
  if (hasNumber) score += 1;
  if (hasSymbol) score += 1;
  if (hasNoWhitespace) score += 1;
  if (differsFromCurrent) score += 1;
  if (isLong) score += 1;

  const suggestions: string[] = [];
  if (!hasMinLength) suggestions.push('add more length');
  if (!(hasLower && hasUpper)) suggestions.push('mix uppercase and lowercase');
  if (!hasNumber) suggestions.push('include a number');
  if (!hasSymbol) suggestions.push('include a symbol');
  if (!hasNoWhitespace) suggestions.push('remove spaces');
  if (!differsFromCurrent) suggestions.push('make it different from the current password');

  if (score <= 3) {
    return {
      tone: 'weak',
      label: 'Weak',
      description: `Too easy to guess. ${joinSuggestions(suggestions)}.`,
      activeBars: 1,
    };
  }

  if (score <= 5) {
    return {
      tone: 'fair',
      label: 'Fair',
      description: `A decent start, but it still needs hardening. ${joinSuggestions(suggestions)}.`,
      activeBars: 2,
    };
  }

  if (score <= 7) {
    return {
      tone: 'good',
      label: 'Good',
      description: suggestions.length > 0
        ? `Solid for admin use. For extra safety, ${joinSuggestions(suggestions)}.`
        : 'Solid for admin use and comfortably above the minimum.',
      activeBars: 3,
    };
  }

  return {
    tone: 'strong',
    label: 'Strong',
    description: 'Strong password. Long, varied, and much harder to brute-force.',
    activeBars: 4,
  };
}
