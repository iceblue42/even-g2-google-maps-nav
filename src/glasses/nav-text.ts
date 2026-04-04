import type { NavProgress } from '../state/types';
import { formatEta, formatDistance } from '../utils/time';

const MANEUVER_ARROWS: Record<string, string> = {
  'turn-left': '<<',
  'turn-right': '>>',
  'turn-slight-left': '</',
  'turn-slight-right': '/>',
  'turn-sharp-left': '<<<',
  'turn-sharp-right': '>>>',
  'uturn-left': 'U-TURN',
  'uturn-right': 'U-TURN',
  'straight': '||',
  'merge': '=>',
  'ramp-left': '</~',
  'ramp-right': '~/>' ,
  'fork-left': '<|',
  'fork-right': '|>',
  'roundabout-left': '(O)',
  'roundabout-right': '(O)',
};

function getArrow(maneuver: string): string {
  // Check exact match first
  if (MANEUVER_ARROWS[maneuver]) return MANEUVER_ARROWS[maneuver];
  // Check prefix for roundabout variants
  if (maneuver.startsWith('roundabout')) return '(O)';
  return '';
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function formatHeader(progress: NavProgress): string {
  return formatEta(progress.etaTimestamp, progress.etaMinutes);
}

export function formatNavInstruction(progress: NavProgress): string {
  const step = progress.currentStep;
  const arrow = getArrow(step.maneuver);
  const instruction = truncate(step.instruction, 80);
  const distance = formatDistance(progress.distanceToStepEnd);

  if (arrow) {
    return `${arrow} ${instruction}\nin ${distance}`;
  }
  return `${instruction}\nin ${distance}`;
}

export function formatFooter(progress: NavProgress, totalSteps: number): string {
  return `Step ${progress.currentStepIndex + 1}/${totalSteps} | ${formatDistance(progress.totalRemainingDistance)} to go`;
}

/** Format a list of upcoming steps for overview mode. */
export function formatStepsList(progress: NavProgress, allSteps: { instruction: string; distance: number }[]): string {
  const start = progress.currentStepIndex;
  const upcoming = allSteps.slice(start, start + 5);
  return upcoming.map((step, i) => {
    const num = start + i + 1;
    const dist = formatDistance(step.distance);
    const instr = truncate(step.instruction, 50);
    return `${num}. ${instr} (${dist})`;
  }).join('\n');
}
